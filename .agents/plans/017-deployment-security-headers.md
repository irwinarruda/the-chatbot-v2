# Plan 017: Deployment Security Headers

## Finding

**Severity: Medium**

The source middleware attempts to set content-type, frame, HSTS, referrer, legacy
XSS, and CSP headers. Those headers were not present on live production responses;
only Vercel's HSTS was consistently visible.

Security policy that exists in source but not on the response received by the
browser is not a control.

The current CSP also needs correction before broad enforcement:

- `script-src` permits `unsafe-inline`;
- `base-uri`, `object-src`, and `form-action` are absent;
- `media-src` is absent;
- `connect-src 'self'` may conflict with actual provider/storage behavior;
- `X-XSS-Protection: 1; mode=block` is obsolete and should not be treated as modern
  XSS protection.

## The mental model

The application can set a header, but proxies, adapters, route types, and deployment
platforms decide which header reaches the browser.

There are therefore two layers:

- **Application policy:** the intended header values and local behavior.
- **Deployment enforcement:** Vercel attaches them to every relevant response.

Both are useful. The second is authoritative for production.

## What the missing headers enable

### Clickjacking

Without `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options: DENY`,
another site can embed the app in an invisible/overlaid frame and trick a user into
clicking authenticated controls. This risk is more important while the auth cookie
uses cross-site semantics; Plan 012 fixes that too.

### MIME confusion

Without `X-Content-Type-Options: nosniff`, browsers have more freedom to interpret a
resource as a different type than declared.

### Referrer leakage

Without an explicit policy, full URLs may be sent as referrers in situations the
application did not intend. OAuth codes should never remain in navigable URLs after
callback, but referrer policy is still a useful boundary.

### Broad resource execution

CSP limits where scripts, styles, frames, forms, media, and network connections may
go. It reduces XSS impact; it does not replace safe rendering, sanitization, or
authorization.

## Security invariants

1. Headers are verified on live HTML, API, redirect, and error responses.
2. Framing is denied by CSP and legacy fallback.
3. CSP names every required resource category and defaults all others closed.
4. Production resource origins are explicit; wildcard origins are not added for
   convenience.
5. CSP is observed in report-only mode before a stricter policy is enforced.
6. Header configuration has one policy source and deployment/local adapters do not
   drift.

## Proposed policy

### Baseline headers

Apply to all application routes unless a documented route-specific reason exists:

```text
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), geolocation=(), microphone=(self)
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

Do not depend on `X-XSS-Protection`. Remove it or explicitly set it to `0` for old
browsers; CSP and safe rendering are the actual protections.

### CSP target

Start from this conceptual policy and adjust only from observed production needs:

```text
default-src 'self';
base-uri 'none';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' <nonce-or-reviewed-temporary-inline-policy>;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
media-src 'self' blob: <private-r2-read-origin>;
worker-src 'self' blob:;
manifest-src 'self';
upgrade-insecure-requests;
```

Google OAuth uses top-level navigation, so Google does not automatically belong in
`connect-src`. Add an origin only when the browser actually fetches that resource
class.

Plan 018 moves audio to private signed R2 URLs. Restrict `media-src` to the exact R2
read origin; do not use `https:` as a blanket source.

## CSP rollout strategy

### 1. Inventory actual browser resources

Inspect production HTML and browser network activity for:

- TanStack/React inline bootstrap scripts;
- generated Vite assets;
- inline styles required by the current UI/tooling;
- WaveSurfer/audio blob and signed R2 requests;
- any fonts/images loaded outside the origin;
- worker/blob usage.

The policy must describe current intentional behavior, not guessed domains.

### 2. Deploy report-only CSP

Set `Content-Security-Policy-Report-Only` with the target directives. Collect reports
through a bounded endpoint or a trusted reporting service. Reports are untrusted
input: size-limit, rate-limit, and never render them as HTML.

Run through login, chat, audio, todos, bills, privacy, errors, and both locales.

### 3. Enforce a useful baseline

Enforce `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, and
`form-action 'self'` early. These provide value even if React's inline bootstrap
temporarily requires `script-src 'unsafe-inline'`.

### 4. Remove inline script permission

Preferred end state is a per-response nonce applied to every intentional inline
script and included in `script-src`. If TanStack/Vercel cannot reliably propagate a
nonce, use stable build-time hashes for generated inline blocks. Do not guess a
nonce implementation before verifying the framework's rendered output.

Keep `style-src 'unsafe-inline'` only as long as the UI stack needs it. Script inline
execution is the higher-priority removal.

## Enforce at the deployment edge

Add Vercel `headers` rules in `vercel.json` so the policy is attached after the
framework adapter. Cover all HTML/API paths, redirects where Vercel supports them,
and framework error responses.

Retain local application middleware for parity, but extract the values into a small
shared policy utility/config so Vercel and application tests compare against the
same intended set. If Vercel JSON cannot import code, add a test that compares the
declared static values rather than manually trusting both copies.

Investigate why `securityMiddleware` did not affect production route responses.
Fixing that improves local/preview parity, but it does not replace edge enforcement.

## Files expected to change

- `vercel.json`
- `src/shared/http/middleware/security.ts`
- a small pure header-policy utility under `src/shared/http/utils` if useful
- CSP report endpoint/DTO only if first-party reporting is chosen
- tests for policy construction and Vercel config coverage
- deployment documentation for CSP/resource-origin changes

No feature module should own global browser security headers.

## Implementation sequence

1. Add edge-enforced frame, nosniff, referrer, permissions, and cross-origin
   baseline headers.
2. Remove/disable the obsolete XSS-protection header.
3. Inventory production resource requirements.
4. Deploy CSP report-only with complete directives.
5. Resolve violations by removing accidental external resources or adding the
   narrow exact origin.
6. Enforce the baseline CSP.
7. Add nonce/hash support and remove `unsafe-inline` from scripts.
8. Verify every exact production deployment after header changes.

## Tests and verification

### Repository tests

- expected headers exist for HTML, API, redirect, and error response policies;
- CSP parser/assertions require `base-uri`, `object-src`, `frame-ancestors`, and
  `form-action`;
- `frame-ancestors` cannot be weakened by a route-specific override;
- `script-src` cannot gain wildcard/`https:` sources;
- `media-src` contains only the exact configured read origins and `blob:` when
  required;
- Vercel catch-all headers cover `/`, `/chat`, `/api/v1/status`, and web APIs.

### Browser/deployed checks

- live responses contain the baseline header values;
- an external page cannot frame production;
- all main workflows operate under report-only CSP without unexpected violations;
- after enforcement, login redirects, hydration, chat, audio playback/recording,
  todos, and bills still work;
- browser console has no unexplained CSP violations;
- HTTPS requests remain covered by Vercel HSTS.

## Rollout and rollback

- Baseline non-CSP headers can ship immediately.
- CSP moves report-only -> baseline enforce -> nonce/hash tightening.
- If enforcement blocks a critical resource, roll back to the last known enforced
  policy or report-only; do not remove all security headers.
- Every temporary CSP exception gets an owner and removal condition.

## Acceptance criteria

- Live production HTML and API responses contain the intended baseline headers.
- Production cannot be framed.
- CSP is enforced with explicit `base-uri`, `object-src`, `frame-ancestors`, and
  `form-action` directives.
- Browser resource origins are narrow and evidence-based.
- `script-src 'unsafe-inline'` is removed or has a documented, time-bounded
  framework blocker.
- Local middleware and Vercel edge policy are tested against the same intended
  values.

## Implementation status — 2026-07-16

- The baseline and complete CSP are enforced by both application middleware and a
  Vercel catch-all header rule.
- The current production build emits request-varying TanStack Start bootstrap
  scripts. `script-src 'unsafe-inline'` remains a temporary framework exception;
  the application maintainer should review nonce propagation by 2026-08-16 and
  remove the exception once every intentional inline script receives a nonce.
- Media access is restricted to same-origin URLs, browser blobs, and the current
  exact R2 read origin. Update both policy declarations together when Plan 018
  replaces that origin with private signed reads; the parity test prevents drift.
- First-party CSP report collection remains deferred. The deployed baseline is
  enforceable without accepting a new public untrusted-input endpoint.
