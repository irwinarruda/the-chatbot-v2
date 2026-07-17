# Plan 014: Encrypted Google Credentials

## Scope decision

The current implementation covers authenticated encryption at rest only. It keeps
the existing Google scopes, offline access, login flow, and cash-flow credential
ownership unchanged.

Separating identity authorization from Google Sheets authorization remains useful
future least-privilege work, but it is explicitly deferred and is not part of this
plan's current acceptance criteria.

## Finding

**Severity: High**

Google access and refresh tokens are stored as plaintext columns in
`google_credentials`. The same Google OAuth flow used for identity login requests
offline access and the full Google Sheets scope. Web login then updates and persists
those reusable tokens.

This couples two capabilities with very different risk:

- proving who the user is;
- editing the user's financial spreadsheet later without the user present.

## The mental model

An OAuth token is a delegated password. Whoever possesses it can perform the
granted operations until it expires or is revoked.

Two controls reduce the damage if one boundary fails:

1. **Least privilege:** a login token should prove identity only; it should not edit
   Sheets.
2. **Encryption at rest:** a database reader should not immediately obtain usable
   provider tokens.

Encryption is not magic. If an attacker controls the running application and its
encryption key, it can decrypt tokens. The control specifically reduces the blast
radius of a database-only leak, backup leak, SQL read, or accidentally exposed dump.

## How the current exposure works

1. `GoogleAuthScopes.buildScopes()` includes `spreadsheets`, `openid`, `email`, and
   `profile` for every flow.
2. `GoogleAuthGateway.createAuthorizationCodeUrl` asks for `access_type: offline`
   and `prompt: consent` for app and web login.
3. Google may return a refresh token with long-lived Sheets authority.
4. `AuthService.saveGoogleCredential` writes access and refresh tokens directly into
   VARCHAR columns.
5. `AuthService.hydrateUser` reads them into `Credential` for later cash-flow calls.
6. A database dump or SQL read yields immediately reusable credentials.

The production-dump development workflow increases the number of places those raw
tokens can exist.

## Why the current `Encryption` helper is not suitable

`src/modules/identity/services/Encryption.ts` uses AES-256-CBC with a fixed IV. It
has no authentication tag, so ciphertext integrity is not verified, and a reused IV
makes equal prefixes deterministic. It was used as an encoding mechanism for OAuth
state; it should not become the credential vault.

Use authenticated encryption with a fresh nonce for every token.

## Current security invariants

1. Reusable provider tokens are encrypted before entering PostgreSQL.
2. The encryption key is outside the database and has a version.
3. Every ciphertext uses a random nonce and an authentication tag.
4. Ciphertext is bound to its credential, owner, and token purpose.
5. Logs, errors, tests, and migration output never reveal plaintext tokens.
6. Key rotation has an explicit path.

## Proposed design in this codebase

### Deferred: Split Google identity from Google Sheets authorization

Keep Google identity OAuth in `src/modules/identity/gateway/AuthGateway` with only:

- `openid`;
- `userinfo.email`;
- `userinfo.profile`.

Web login should use online access, no forced consent, and no token persistence. The
callback exchanges the code, fetches the user identity, creates the local web
session from Plan 012, and discards the provider token.

Move Sheets authorization into the cash-flow capability:

```text
src/modules/cash-flow/gateway/SpreadsheetAuthGateway/
  index.ts
  GoogleSpreadsheetAuthGateway.ts
  TestSpreadsheetAuthGateway.ts
```

The user explicitly starts “Connect Google Sheets” from an authenticated WhatsApp
or web flow. That flow requests the Sheets scope and offline access. Plan 011's
state/PKCE/challenge rules apply to it too.

Cash flow then owns a `GoogleSheetsConnection`/credential lifecycle because it owns
the feature that uses the authority. Identity may publish the authenticated user ID
needed to start the flow; it should not own Sheets provider details.

### 2. Add an authenticated encryption gateway

Create one app-wide external secret-protection boundary because identity/session
adjacent flows and cash flow may both need to protect recoverable secrets:

```text
src/shared/gateway/SecretEncryptionGateway/
  index.ts

infra/
  AesGcmSecretEncryptionGateway.ts
```

The interface should deal in an owned envelope DTO, not raw provider types:

```text
EncryptedSecretDTO
  keyVersion
  algorithm
  nonce
  ciphertext
  authenticationTag
```

The first implementation can use AES-256-GCM with:

- a 32-byte base64-decoded key supplied through production secret configuration;
- a fresh 96-bit random nonce per encryption;
- an authentication tag;
- associated data binding the ciphertext to credential purpose and user/record ID.

Associated data prevents a valid ciphertext from one user/purpose being silently
moved to another row.

A cloud KMS can later implement the same gateway with envelope encryption. Do not
block the plaintext removal on introducing a large cloud platform if a properly
managed Vercel secret key is the practical first step.

### 3. Store versioned envelopes, not plaintext columns

For each reusable token, store a JSONB envelope or explicit binary columns. JSONB is
readable for versioning and avoids multiplying migration columns:

```text
access_token_envelope JSONB
refresh_token_envelope JSONB
```

Never store the raw key beside the envelope. Validate the envelope through a Zod DTO
when hydrating from PostgreSQL.

Keep plaintext columns temporarily only for the migration sequence below.

### 4. Use expand, backfill, contract

Generate migrations through the repository script.

#### Expand

```bash
bun run migrate:create -- add-encrypted-google-credential-envelopes
```

- add nullable envelope columns;
- deploy code that writes encrypted envelopes only;
- read envelope first, plaintext only as a temporary fallback;
- emit a metric when fallback occurs, never the token.

#### Backfill

- run a bounded, restartable backfill that encrypts plaintext rows;
- use row IDs/cursors and transactions in small batches;
- verify every non-null plaintext token has a decryptable envelope;
- do not print plaintext or full envelopes;
- restrict production dump/snapshot access during the window.

#### Contract

```bash
bun run migrate:create -- remove-plaintext-google-credentials
```

- make required envelope columns non-null for reusable credentials;
- drop `access_token` and `refresh_token` plaintext columns;
- remove the fallback code and metric.

Do not combine expand and drop into one deployment. The running previous version
must remain compatible while the new artifact is rolling out.

### Deferred: Rotate/re-authorize existing delegated access

Encrypting a token does not undo its previous plaintext lifetime. After the
encrypted path is stable:

1. Revoke existing Google grants or require users to reconnect Sheets.
2. Replace stored tokens with newly issued least-privilege Sheets credentials.
3. Delete legacy broad-scope credentials.

This is the cleanest way to prove no previously copied broad token remains valid.
If a full immediate reauthorization is too disruptive, stage users and document the
temporary residual risk.

### 6. Make key rotation explicit

Add configuration such as:

```text
CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION=v1
CREDENTIAL_ENCRYPTION_KEY_V1=<32-byte base64 secret>
```

Config parsing must decode and verify exact key length, reject placeholders, and
never include the secret in an error. Rotation:

1. add `v2` key while retaining `v1` for reads;
2. set active version to `v2` for new writes;
3. re-encrypt old envelopes in batches;
4. verify no `v1` rows remain;
5. remove `v1` from production configuration.

### 7. Reduce in-memory and logging exposure

- For this phase, decrypt at the identity persistence boundary so the existing
  `Credential` and cash-flow paths remain unchanged.
- Do not put tokens in entity `toJSON`, errors, log context, tool results, or HTTP
  DTOs.
- Keep provider token DTOs private to the gateway boundary where possible.
- Create request-local Google OAuth clients; do not set credentials on shared
  instances.
- Preserve a prior refresh token when Google returns no new refresh token; an empty
  string must not overwrite a valid token.

## Files expected to change

- `src/modules/identity/services/AuthService.ts`
- `src/modules/identity/services/GoogleCredentialEncryptionService.ts` (new)
- `src/shared/gateway/SecretEncryptionGateway/index.ts` (new)
- `src/shared/entities/dtos/EncryptedSecretDTO.ts` (new)
- `infra/AesGcmSecretEncryptionGateway.ts` (new)
- `src/shared/config/Config.ts`
- `infra/bootstrap.ts`
- generated expand migration and restartable backfill script
- credential, gateway, config, and migration integration tests

## Implementation sequence

1. Add strict encrypted-secret config and the AES-GCM gateway.
2. Add envelope columns and encrypted-first dual-read code.
3. Write only encrypted envelopes for new and updated credentials.
4. Backfill existing credential rows and verify coverage.
5. Drop plaintext columns and remove the temporary fallback in a later contract
   deployment.
6. Exercise a key rotation in non-production before declaring the design complete.

## Tests

### Encryption gateway tests

- encrypt/decrypt round trip;
- same plaintext produces different ciphertext because nonce is random;
- tampered ciphertext, nonce, tag, or associated data fails;
- wrong key version fails with a safe error;
- decoded key length is enforced;
- test failures never render plaintext.

### Service tests

- token writes call encryption before SQL;
- token reads prefer and decrypt authenticated envelopes;
- user A's envelope cannot be decrypted as user B's associated data.

### Database integration tests

- new writes leave plaintext columns null during expansion;
- backfill is idempotent and restartable;
- every legacy row receives decryptable envelopes;
- contract migration refuses/detects incomplete backfill;
- final schema contains no plaintext token columns.

### Deployed verification

- verify a production database query exposes envelopes, not reusable tokens;
- run the restartable backfill until it reports zero remaining rows;
- verify normal login, token refresh, and Sheets operations still work.

## Rollout and rollback

- The expand deployment is backward-compatible; the contract deployment is not.
- Keep old decryption keys until every row is re-encrypted and rollback artifacts
  are outside the deployment window.
- A rollback may restore encrypted-first dual-read code but must never resume
  plaintext writes.

## Acceptance criteria

- All reusable production Google tokens are authenticated ciphertext at rest.
- No plaintext token column or fallback remains after contract migration.
- Encryption keys are validated, versioned, external to PostgreSQL, and rotatable.
- Existing OAuth scopes and authorization flows continue to behave as before.
