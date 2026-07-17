# Plan 012: Browser JWT and CSRF Defense

## Decision

Keep the existing signed JWT web session for now. Harden the browser boundary that
uses it instead of introducing opaque database sessions, a session table, or a new
authentication subsystem.

This plan closes the current cross-site request forgery path and reduces token
confusion risk. It does not make individual JWTs server-revocable.

## Finding

**Severity: High**

The production auth cookie is set to `SameSite=None`, authenticated write routes do
not verify request origin, and JSON controllers call `request.json()` without first
requiring `Content-Type: application/json`.

That combination permits cross-site request forgery in browsers that send
third-party cookies. The attacker may not read the response, but can still cause the
side effect.

The current web session is a seven-day JWT. Verification checks its signature and
expiry and then loads the user, but previously did not bind the token to an issuer,
audience, or web-session purpose. Authentication also did not reject inactive users.

## Security model

The JWT proves that the server issued the browser identity. It does not prove that
the authenticated user intentionally sent a write from this application because
browsers attach cookies automatically.

Every authenticated write therefore requires two independent facts:

1. a valid JWT issued specifically for this web application; and
2. browser evidence that the request came from the application's exact origin.

`SameSite=Lax`, strict origin validation, Fetch Metadata checks, and JSON-only
transport rules work together. None of them is treated as the sole defense.

## Scope

### 1. Harden and centralize the web auth cookie

Use one shared helper for cookie reads, writes, and deletion so authentication,
OAuth redirect, logout, and server-side access checks cannot drift.

Production HTTPS uses `__Host-web_auth_token` with:

- `HttpOnly`;
- `Secure`;
- `Path=/`;
- `SameSite=Lax`;
- no `Domain` attribute;
- the existing seven-day maximum age.

Local HTTP development uses the non-prefixed `web_auth_token` cookie because the
`__Host-` prefix requires HTTPS.

The application does not accept the legacy production `web_auth_token` cookie over
HTTPS. Login and logout clear that legacy cookie while setting or deleting the new
one. This creates a deliberate one-time production logout at deployment.

### 2. Require same-origin proof for unsafe web requests

Apply request middleware to `POST`, `PUT`, `PATCH`, and `DELETE` requests under
`/api/v1/web/**`.

The middleware:

1. requires an `Origin` header;
2. parses and compares its normalized origin exactly with the request origin;
3. rejects `Sec-Fetch-Site: cross-site` when present;
4. rejects a `Referer` from another origin when present;
5. returns a stable 403 error without reflecting attacker input.

Safe methods and non-web integrations are not subject to this browser-specific
policy. Authenticated `GET` and `HEAD` handlers must remain free of business side
effects.

### 3. Require JSON before parsing JSON

Every unsafe web controller that consumes JSON must reject a missing or non-JSON
media type before reading the body.

Accept `application/json` with optional parameters such as `charset=utf-8`. Return:

- 415 for a missing or unsupported media type;
- 400 for malformed JSON;
- the existing DTO validation response for structurally invalid JSON.

The audio endpoint retains its separate audio media-type allowlist.

### 4. Protect web routes by default

Every route under `/api/v1/web/**` requires authentication unless its exact path is
one of:

- `/api/v1/web/auth/login`;
- `/api/v1/web/auth/redirect`;
- `/api/v1/web/auth/logout`.

Logout remains callable without a valid JWT so the browser can always clear its
cookie, but the same-origin middleware still protects the unsafe request.

This reverses the previous fail-open route allowlist. A future web controller is
authenticated without requiring another middleware edit.

### 5. Bind and validate the existing JWT

Keep HS256 and the configured secret and expiry. Require:

- the explicit `HS256` verification algorithm;
- issuer `the-chatbot`;
- audience `the-chatbot-web`;
- purpose `web-auth`;
- the existing expiry;
- a current database user with the matching email;
- `isInactive = false`.

The application already reloads the user while authenticating every JWT, so the
inactive-user rule does not add another database round trip.

### 6. Preserve OAuth request validation

This plan does not replace Plan 011's OAuth transaction and `state` validation.
OAuth callbacks are public GET endpoints with their own request-forgery boundary.
They must create a JWT only after the matching OAuth transaction is validated.

## Explicitly out of scope

- `web_sessions` table or migration;
- opaque session tokens;
- server-side session storage;
- per-session logout revocation;
- session cleanup jobs, idle expiry, or rotation;
- synchronizer or double-submit CSRF tokens;
- accepting both legacy and hardened production cookie names;
- a new authentication gateway or authentication subsystem.

## Accepted residual risk

A copied JWT remains valid until its seven-day expiry even after browser logout.
There is no way to revoke one JWT individually. Rotating the signing secret revokes
all JWTs at once.

`HttpOnly`, `Secure`, `SameSite=Lax`, and the `__Host-` prefix reduce the ways a
browser token can leak or be mis-scoped, but they do not turn the JWT into a
revocable session.

That residual risk is accepted for this containment phase. If individual session
revocation becomes a product requirement or a token-theft incident occurs, design a
separate, deliberately scoped session-lifecycle plan instead of silently expanding
this one.

## Files changed

- `src/modules/identity/entities/dtos/IdentityDTO.ts`
- `src/modules/identity/services/AuthService.ts`
- `src/modules/identity/services/Jwt.ts`
- `src/shared/errors/ApplicationErrors.ts`
- `src/shared/http/controllers/web-auth-logout.ts`
- `src/shared/http/controllers/web-auth-redirect.ts`
- unsafe web JSON controllers
- `src/shared/http/functions/require-web-access.ts`
- `src/shared/http/middleware/auth.ts`
- `src/shared/http/middleware/webRequestSecurity.ts`
- `src/shared/http/utils/JsonRequest.ts`
- `src/shared/http/utils/WebAuth.ts`
- `src/shared/http/utils/WebAuthCookie.ts`
- `src/start.ts`
- focused HTTP and Auth Service tests

No migration is created.

## Tests

### Browser request tests

- future `/api/v1/web/**` paths require authentication by default;
- exact public auth paths remain public;
- same-origin unsafe requests pass;
- missing or wrong `Origin` returns 403;
- `Sec-Fetch-Site: cross-site` returns 403;
- a cross-origin `Referer` returns 403;
- safe methods and non-web integrations are unaffected.

### JSON transport tests

- `application/json; charset=utf-8` is accepted;
- `text/plain`, form, and missing content types return 415;
- malformed JSON returns 400 before a controller side effect;
- DTO validation still owns the parsed payload shape.

### Cookie tests

- HTTPS uses `__Host-web_auth_token`;
- production attributes include `HttpOnly; Secure; Path=/; SameSite=Lax`;
- production cookies contain no `Domain` or `SameSite=None`;
- local HTTP uses the non-prefixed cookie without `Secure`;
- deletion preserves the active cookie's path and security attributes;
- HTTPS authentication ignores the legacy cookie name.

### JWT and user tests

- issued web JWTs round-trip through authentication;
- missing, malformed, expired, incomplete, and wrong-purpose tokens fail;
- a missing, stale, email-mismatched, or inactive user fails;
- tokens without an optional phone number remain valid.

## Acceptance criteria

- Cross-origin requests cannot perform cookie-authenticated web writes.
- Unsafe JSON routes reject non-JSON media types before parsing.
- `/api/v1/web/**` is authenticated by default.
- Production uses a host-only, secure, HttpOnly, `SameSite=Lax` cookie.
- JWT verification is bound to its algorithm, issuer, audience, and purpose.
- Inactive users cannot authenticate.
- The implementation contains no new session table, opaque session system, or
  migration.
- The remaining lack of individual JWT revocation is documented and accepted.
