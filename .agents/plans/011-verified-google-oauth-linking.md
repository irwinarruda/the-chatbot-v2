# Plan 011: Verified Google OAuth Linking

## Finding

**Severity: Critical**

The app-link endpoint accepts an arbitrary phone number, email, or BSUID from the
public internet and treats it as the identity that should receive the Google account
being authorized.

The route is `GET /api/v1/google/login?id=...`. The `id` comes directly from the
query string in `src/shared/http/controllers/google-login.ts`, is passed to
`AuthService.handleGoogleLogin`, encrypted into OAuth `state`, and later used by
`AuthService.saveUserFromGoogleAuth` to find, update, or create a user.

The encryption makes the value unreadable in the redirect, but it does not prove who
supplied it. The server itself will encrypt any value an unauthenticated caller asks
it to encrypt.

## The mental model

OAuth answers one question:

> Which Google account approved this callback?

It does not answer:

> Which WhatsApp user should receive that Google account?

The application must establish that second fact before OAuth starts. Today it uses
knowledge of an identifier as proof. Phone numbers and BSUIDs are identifiers, not
secrets. A secure link needs a short-lived bearer challenge that is created only
after a message arrives through the verified WhatsApp webhook.

Think of the difference as an address versus a ticket:

- A phone number tells the server where the account should go.
- A challenge proves the holder was handed a one-time ticket in that WhatsApp
  conversation.

The analogy stops at one point: unlike a paper ticket, the server stores only a hash
of the challenge and consumes it atomically, so a database reader cannot use it and
two callbacks cannot spend it.

## How the current attack works

### Pre-hijacking an existing unlinked user

1. The attacker learns or guesses a victim's phone number or BSUID.
2. The attacker opens `/api/v1/google/login?id=<victim-address>`.
3. The server looks up the victim. If the victim has no Google credential, the
   server creates a Google authorization URL.
4. The server places the victim address into encrypted OAuth `state`.
5. The attacker approves OAuth with the attacker's own Google account.
6. Google redirects to `/api/v1/google/redirect` with the code and state.
7. The server decrypts the victim address and associates the attacker's Google
   tokens/email with that identity.
8. The attacker can then use the web Google login flow as the linked Google account.

The cryptography works exactly as written. The authorization decision around it is
wrong.

### Creating a user under someone else's address

If no user matches the supplied address, `saveUserFromGoogleAuth` may create a new
user and copy the attacker-supplied address into `phoneNumber` or `bsuid`. That lets
an attacker reserve an identity before its real owner registers.

### Replay and link leakage

Current app OAuth state is encrypted data with no server-side expiration or
consumption record. A previously issued link can be replayed. The `Encryption`
helper uses AES-CBC with a fixed IV and no authentication tag; even aside from the
main flaw, it is not the right primitive for a single-use authorization lifecycle.

### Web login confusion

The separate web login starts OAuth with no state and no PKCE. A callback code is
accepted without proving it belongs to a login initiated in the same browser. This
enables login-CSRF/account-confusion patterns: a victim can be made to finish an
OAuth flow initiated by someone else.

## Why the existing defenses do not fix it

- **Encryption:** hides the address after issuance; it does not authenticate the
  caller who asked the server to issue it.
- **Google OAuth:** proves control of the Google account, not control of WhatsApp.
- **CORS:** the attack can be performed through normal navigation; CORS is not an
  authorization system.
- **Random-looking state:** state is only useful when it is bound to an initiating
  transaction, expires, and cannot be replayed.
- **Email collision checks:** they prevent some mismatched merges after the
  attacker has entered the flow; they do not establish control of the target
  channel address.

## Security invariants

1. Only an authenticated provider event may issue an app-link challenge for its own
   channel address.
2. A public caller can present a challenge but cannot choose or change the address
   behind it.
3. A challenge expires quickly and is consumed once.
4. The OAuth callback must match the flow, state, redirect URI, and PKCE verifier
   that initiated it.
5. App linking and web login use separate transaction types and cannot exchange
   state.
6. Starting login does not refresh tokens or reveal whether an arbitrary identifier
   is already linked.

## Proposed design in this codebase

### 1. Persist app-link challenges in identity

Add an identity-owned `google_auth_challenges` table with this conceptual shape:

```text
id UUID primary key
token_hash BYTEA unique not null
flow VARCHAR not null              -- AppLink or WebLogin if persisted together
channel_address VARCHAR            -- required for AppLink
pkce_verifier_envelope JSONB       -- only when the server must retain it
expires_at TIMESTAMPTZ not null
consumed_at TIMESTAMPTZ
created_at TIMESTAMPTZ not null
```

The raw challenge is 32 random bytes encoded as base64url. Persist only
`SHA-256(rawChallenge)`. A ten-minute TTL is enough for the user to complete Google
consent without creating a long-lived bearer link.

Create the migration with:

```bash
bun run migrate:create -- create-google-auth-challenges
```

The identity module owns the SQL in `AuthService` or, if the lifecycle makes
`AuthService` harder to scan, a focused `GoogleAuthChallengeService` under
`src/modules/identity/services`. Do not create a generic token repository.

### 2. Issue the link from the verified WhatsApp path

Replace synchronous `AuthService.getAppLoginUrl(appAddress)` with an asynchronous
capability such as:

```text
AuthService.createAppLoginUrl(verifiedChannelAddress)
```

`MessagingService.sendLoginMessage` calls it only after:

- the webhook signature has been validated;
- the Meta payload has been parsed;
- the channel address came from that verified payload.

The generated link becomes:

```text
/api/v1/google/login?challenge=<opaque-random-value>
```

It never contains a raw phone number, email, user ID, or BSUID.

### 3. Make the login route a challenge consumer, not an identity selector

Change `google-login.ts` to parse a named Zod request DTO such as
`StartAppGoogleLoginRequestDTO` from `src/modules/identity/entities/dtos`.

The route calls one Service workflow:

```text
AuthService.startAppGoogleLogin(challenge)
```

The Service hashes the challenge, finds an unexpired `AppLink` record, and creates
the Google authorization URL. It must not accept an address parameter.

Do not mark the challenge consumed at this first GET. Browser prefetchers and link
scanners can visit links. Mark it started if useful for telemetry, but consume it
only when the OAuth callback succeeds.

### 4. Use state and PKCE on every OAuth authorization-code flow

Change the gateway contract so state is required and the flow is explicit. Avoid
optional positional parameters such as the current
`createAuthorizationCodeUrl(state?, redirectTarget?)`.

Use an input DTO conceptually like:

```text
CreateGoogleAuthorizationUrlDTO
  flow
  state
  codeChallenge
  scopes
  accessType
  prompt

ExchangeGoogleCodeDTO
  flow
  code
  codeVerifier
```

The Google gateway owns provider option names. `AuthService` owns transaction
creation, expiry, consumption, and which business flow is allowed.

For the app flow, the persisted challenge can also be the OAuth state value. Store
the PKCE verifier encrypted or store a separately generated verifier envelope keyed
by the challenge. At callback:

1. Hash state and lock the matching challenge row.
2. Reject wrong flow, expired, missing, or consumed rows.
3. Exchange the code using the stored verifier and app redirect URI.
4. Validate Google identity.
5. Link only the server-stored channel address.
6. Mark the challenge consumed in the same database transaction as the user and
   credential changes where possible.

Provider exchange is external and cannot be atomic with PostgreSQL. The safe policy
is: exchange first, then atomically claim the challenge and write the link. If two
callbacks race, only one database claim may succeed. A consumed code cannot be used
to authorize a different target.

### 5. Bind web login to the initiating browser

For `/api/v1/web/auth/login`:

1. Generate random state and a PKCE verifier.
2. Put the state and verifier into short-lived, `HttpOnly`, `Secure`,
   `SameSite=Lax` transaction cookies, or persist their hashes in a short-lived
   database transaction referenced by a cookie.
3. Send the state and PKCE challenge to Google.
4. On callback, compare state in constant time, use the matching verifier, and clear
   the transaction cookies on both success and failure.

Do not use the long-lived web session cookie as OAuth transaction state. Login state
and authenticated session state have different lifecycles.

### 6. Remove side effects from login-start GETs

`handleGoogleLogin` currently refreshes credentials and synchronizes chat addresses
when the supplied identifier is already linked. Starting a login URL should not
refresh provider tokens or mutate database records.

After the challenge change:

- a valid challenge always starts the appropriate flow or returns a generic
  already-linked message for that challenge;
- arbitrary identifiers cannot be queried;
- refresh and address synchronization happen in authenticated workflows, not a
  public GET.

### 7. Avoid shared mutable OAuth client credentials

`GoogleAuthGateway` calls `setCredentials` on long-lived shared OAuth client
instances. Concurrent requests can overwrite one another's access tokens.

Keep immutable client configuration on the gateway, but create a fresh OAuth2
client for each token-bearing operation. Authorization URL generation, code
exchange, user-info lookup, and refresh each receive a request-local client.

This is a concurrency hardening change, not the main account-takeover fix.

## Files expected to change

- `src/modules/chat/services/MessagingService.ts`
- `src/modules/identity/services/AuthService.ts`
- `src/modules/identity/entities/dtos/IdentityDTO.ts` or smaller owned DTO files
- `src/modules/identity/entities/dtos/AuthGatewayDTO.ts`
- `src/modules/identity/gateway/AuthGateway/index.ts`
- `src/modules/identity/gateway/AuthGateway/GoogleAuthGateway.ts`
- `src/modules/identity/gateway/AuthGateway/TestAuthGateway.ts`
- `src/shared/http/controllers/google-login.ts`
- `src/shared/http/controllers/google-redirect.ts`
- `src/shared/http/controllers/web-auth-login.ts`
- `src/shared/http/controllers/web-auth-redirect.ts`
- `infra/migrations/<generated>_create-google-auth-challenges.js`
- identity Service/DTO/database integration tests

Plan 014 later splits identity scopes from Sheets scopes and encrypts reusable
tokens. Keep that separation in mind, but do not block the critical challenge fix
on the full credential migration.

## Implementation sequence

1. Contain production by disabling raw-ID login generation and the public raw-ID
   route.
2. Add challenge DTOs, persistence, expiry, hashing, and atomic consumption.
3. Change the WhatsApp login-message path to issue opaque challenge links.
4. Change app login and callback routes to use the challenge only.
5. Make state and PKCE mandatory in the gateway contract.
6. Add web transaction cookies/state/PKCE and clear them after callback.
7. Make OAuth clients request-local.
8. Hard-cut the old encrypted-address OAuth state path (done: challenge table only;
   `Encryption.ts` removed).
9. Rotate/invalidate any identity link known to have been created during testing or
   from an unverified flow.

## Tests

### Service tests

Cover with deterministic gateway/database fakes:

- challenge issuance returns a raw token once and stores only its hash;
- app login resolves the server-stored channel address;
- arbitrary address input is no longer part of the public Service API;
- missing, expired, wrong-flow, and consumed challenges fail;
- successful callback consumes the challenge once;
- two concurrent callback claims produce exactly one link;
- a Google email already bound to another user does not merge identities;
- a valid unregistered WhatsApp challenge may create exactly that channel user;
- web login produces state and PKCE and callback requires both;
- web and app states cannot be swapped;
- provider exchange failure leaves the challenge retry policy explicit;
- starting login does not refresh existing credentials or sync chat addresses.

### Gateway integration tests

- authorization URL contains non-empty state and PKCE challenge;
- token exchange sends the verifier and correct redirect URI;
- identity and web flows do not share mutable credentials;
- Google errors are translated without exposing tokens or codes.

### Database integration tests

- `token_hash` is unique;
- expiry and consumed predicates are enforced by the claim query;
- the claim/link transaction prevents double consumption;
- no plaintext channel address appears in the public URL or OAuth state.

### Deployed verification

- `/api/v1/google/login?id=arbitrary` no longer starts OAuth;
- a link issued from a real verified WhatsApp interaction starts OAuth;
- replaying its callback fails;
- web authorization has non-empty state and PKCE parameters;
- a callback without the matching transaction cookie fails and creates no session.

Do not complete a real link to someone else's address while testing.

## Rollout and compatibility

- This is a deliberate hard cutover for old app-login links. Existing links should
  expire rather than remain a permanent bypass.
- Deploy the additive challenge migration before code that writes challenges.
- During the short containment window, tell users to request a new sign-in link from
  WhatsApp after the secure flow is deployed.
- Monitor challenge issued/started/consumed/expired counters without logging raw
  challenges, OAuth codes, tokens, phone numbers, or email addresses.

## Acceptance criteria

- No public route accepts an address that determines the account-link target.
- App-link target identity comes only from a verified provider message stored
  server-side.
- State is high entropy, expiring, flow-bound, and single-use.
- App and web code exchanges require PKCE.
- Web callback state is bound to the initiating browser.
- Starting a login has no credential-refresh or user-sync side effects.
- Replays and concurrent double use fail closed.
- No OAuth code, verifier, challenge, access token, or refresh token is logged.
