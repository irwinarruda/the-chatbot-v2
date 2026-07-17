# Plan 010: Security Remediation Roadmap

## Decision

Treat the audit as nine connected workstreams, not nine unrelated patches.

The critical path is identity first: stop unverified Google account linking, then
replace the browser session and CSRF boundary. After that, make destructive AI
actions deterministic, encrypt and narrow Google credentials, complete deletion,
and harden media, deployment, dependencies, and operations.

This plan indexes the detailed plans. It does not replace them.

## Snapshot and scope

- Repository snapshot audited: `ddf57e4`
- Production origin audited: `https://the-chatbot.irwinarruda.com`
- Audit date: 2026-07-16
- Scope: application code, HTTP behavior, production headers, authentication,
  OAuth, AI tools, persistence, storage, CI, dependencies, repository settings,
  environment handling, and local production-data workflows
- Out of scope: destructive penetration testing, provider-account administration,
  database mutation, production migration execution, and credential rotation

The audit was read-only. The plans below describe implementation and rollout work;
they do not claim those changes are already present.

## The security model in one sentence

Every sensitive effect must be authorized by a server-verifiable fact that an
attacker cannot manufacture: a verified channel challenge, a same-origin session,
an action-bound confirmation, an owner check, or a narrowly scoped credential.

The current system sometimes substitutes weaker signals:

- knowledge of a phone number or BSUID instead of possession of the WhatsApp
  conversation;
- a browser cookie without a same-origin write check;
- an LLM's interpretation of the conversation instead of a server confirmation
  state;
- possession of the database instead of possession of both database and encryption
  key;
- a soft-deleted chat instead of deletion of all user-owned data.

Security work here is mostly replacing those weak signals with explicit proofs.

## Workstream index

| Order | Plan | Severity | Primary invariant |
|---:|---|---|---|
| 1 | [011: Verified Google OAuth linking](./011-verified-google-oauth-linking.md) | Critical | Only a challenge issued from a verified channel can bind that channel identity to Google |
| 2 | [012: Browser session and CSRF defense](./012-browser-session-and-csrf-defense.md) | High | A browser write requires a valid revocable session and proof that the request came from this origin |
| 3 | [013: Server-enforced AI action confirmation](./013-server-enforced-ai-action-confirmation.md) | High | The model may propose a destructive action; only an action-bound user confirmation may authorize it |
| 4 | [014: Encrypted, least-privilege Google credentials](./014-encrypted-least-privilege-google-credentials.md) | High | A database read alone must not reveal reusable OAuth tokens, and login must not grant Sheets access |
| 5 | [015: Complete account data deletion](./015-complete-account-data-deletion.md) | High | A completed deletion leaves no user-owned database rows or media objects |
| 6 | [016: Reproducible, secure supply chain](./016-reproducible-secure-supply-chain.md) | High | The reviewed dependency graph must be the graph built and deployed |
| 7 | [017: Deployment security headers](./017-deployment-security-headers.md) | Medium | Security headers must be present on the response that reaches the browser |
| 8 | [018: Private API cache and audio lifecycle](./018-private-api-cache-and-audio-lifecycle.md) | Medium | Private responses and media must not become shared or permanent bearer data |
| 9 | [019: Operational endpoint and runtime hardening](./019-operational-endpoint-and-runtime-hardening.md) | Medium | Public runtime inputs and operational controls expose only the minimum surface and are bounded |

## Finding coverage

The detailed plans cover both the eight headline findings and the secondary
hardening findings from the audit.

| Audit finding | Owning plan |
|---|---|
| Arbitrary `id` accepted by `/api/v1/google/login` | 011 |
| Replayable/malleable app OAuth state | 011 |
| Web OAuth has no state or PKCE | 011 |
| App login performs provider and database side effects through a public GET | 011 |
| Linked-account enumeration through redirect differences | 011 |
| Shared mutable Google OAuth clients | 011 and 014 |
| `SameSite=None` authenticated cookie | 012 |
| No CSRF/origin/fetch-metadata enforcement | 012 |
| JSON parsed without enforcing JSON content type | 012 |
| Web API authentication is a fail-open path allowlist | 012 |
| Inactive users can still authenticate | 012 |
| JWT lacks issuer, audience, purpose, and revocation | 012 |
| Destructive AI tools rely on prompt-only confirmation | 013 |
| Google access and refresh tokens are plaintext | 014 |
| Web login requests offline Google Sheets write access | 014 |
| Account deletion leaves chats, messages, and media | 015 |
| Privacy-policy deletion promise is not met | 015 |
| Ignored lockfile and unrestricted installs | 016 |
| Vulnerable dependency graph | 016 |
| Mutable GitHub Action tags and incomplete CI | 016 |
| Public, unprotected `main` and disabled Dependabot security updates | 016 |
| Missing live CSP/frame/nosniff/referrer/permissions headers | 017 |
| Authenticated API responses marked publicly cacheable | 018 |
| Permanent public R2 audio URLs | 018 |
| Unbounded request buffering and recording duration | 018 |
| Process-local web audio buffers are never released | 018 |
| Blob URLs are not revoked | 018 |
| Public status and migration details | 019 |
| Static migration password and migration locking disabled | 019 |
| Malformed WhatsApp signatures can cause a timing-safe comparison exception | 019 |
| Meta bearer token may be forwarded to an unvalidated media host | 019 |
| Missing public-endpoint rate and body limits | 019 |
| Production-like env files have weak local permissions | 019 |
| Known placeholders can satisfy production config's non-empty checks | 019 |
| Local Postgres listens on all interfaces with fixed credentials | 019 |
| Production database URLs are passed in process arguments and broad child env | 019 |

## Delivery phases

### Phase 0: emergency containment

Ship the smallest safe reductions first, before the full designs are complete.

1. Disable `/api/v1/google/login?id=...` and stop generating those links. Return a
   maintenance response or omit the link until Plan 011 is deployed.
2. Temporarily remove `delete_user_by_chat_channel_address` and other irreversible
   tools from the AI registry until Plan 013 is deployed.
3. Change the production auth cookie to `SameSite=Lax` and reject unsafe web API
   requests that are cross-origin or are not `application/json`.
4. Set authenticated responses to `Cache-Control: private, no-store` and
   `Vary: Cookie`.
5. Remove or strongly restrict the production migration endpoint.
6. Enforce framing and content-type headers at Vercel.

These are containment changes, not the final architecture. They deliberately reduce
functionality where the secure replacement needs more work.

### Phase 1: re-establish identity and browser trust

Implement Plans 011, 012, and the enforceable portion of 017.

The order matters:

1. Verified app-link challenges prevent account pre-hijacking.
2. OAuth state and PKCE bind Google callbacks to the initiating browser/flow.
3. Opaque database sessions make logout, deactivation, and deletion immediately
   enforceable.
4. Same-origin write checks remove CSRF as a path into authenticated services.
5. Edge headers make browser-side policy visible in production.

### Phase 2: protect irreversible effects and valuable data

Implement Plans 013, 014, 015, and 018.

- Confirmation becomes a persisted state machine with a single-use action ID.
- Google login and Google Sheets authorization become separate capabilities.
- Existing tokens move through an encrypted dual-read/backfill/drop migration.
- Account deletion becomes an idempotent workflow that covers database and R2.
- Audio objects become private and receive bounded, owner-authorized access.

### Phase 3: make the secure state durable

Implement Plans 016 and 019, then remove temporary compatibility paths.

- Commit the lockfile and require frozen installs.
- Upgrade the vulnerable dependency graph and make audit results a CI gate.
- Protect `main` and pin Actions.
- Remove public operational controls and reduce runtime information leakage.
- Bound webhook and upload inputs.
- reject production placeholders and harden local production-data handling.

## Cross-plan architectural decisions

### Keep ownership feature-local

- Identity owns OAuth challenges, Google identity login, browser sessions, and
  account lifecycle.
- Chat owns model/tool orchestration, pending tool actions, messages, and media
  references.
- Cash flow owns Google Sheets connections and Sheets-specific OAuth scope.
- Shared HTTP owns origin/content-type/cache/header middleware.
- System owns liveness and migration tooling, but production migrations move out of
  the public application API.

### Use database state for security lifecycles

Vercel instances are ephemeral and concurrent. Process-local maps cannot be the
source of truth for OAuth challenges, sessions, action confirmations, deletion jobs,
or rate limits. Durable state belongs in PostgreSQL or in an explicit external
gateway designed for distributed use.

### Hash bearer secrets before persistence

Session tokens and OAuth challenge tokens are bearer secrets. Store only a SHA-256
hash; send the raw value to the intended client once. Confirmation buttons use an
HMAC-authenticated transport value derived from a non-secret pending action ID, and
that transport value is not persisted. If the database leaks, its rows alone cannot
be used as the bearer authorization.

### Encrypt reusable provider credentials

OAuth access and refresh tokens must be recoverable by the application, so hashing
is not possible. Encrypt them with authenticated encryption and a key held outside
the database. Do not reuse the current fixed-IV AES-CBC helper.

### Prefer denial over ambiguous recovery

If a challenge is expired, a confirmation was consumed, a session is revoked, a
request origin is absent, or a media object is not owned by the user, reject the
operation. Security-sensitive paths should not guess what the caller meant.

## Migration policy

Every schema change must be generated with:

```bash
bun run migrate:create -- <name>
```

Use expand/backfill/contract for credentials and media because existing production
rows must remain readable during deployment. Small additive tables such as
`web_sessions`, `google_auth_challenges`, and `pending_tool_actions` can normally be
introduced in one additive migration before the code that uses them.

Do not combine all security schema changes into one migration. Each workstream must
be independently deployable and reversible.

## Validation policy

Each detailed plan identifies its narrowest tests. At each production-shipping
boundary, also run the repository's normal validation flow:

```bash
bun run check
bun run typecheck
bun run test
```

When a plan changes migrations, add PostgreSQL integration coverage and verify the
pending production migration set before applying it. When a plan changes HTTP
headers or OAuth redirects, verify the exact deployed commit after Vercel reports it
as production.

## Completion criteria

The remediation program is complete only when all of these are true:

- A raw phone number, email, or BSUID cannot initiate or complete account linking.
- OAuth callbacks reject missing, wrong, expired, replayed, or cross-flow state.
- Authenticated writes reject cross-origin and non-JSON requests.
- Sessions can be revoked and inactive/deleted users cannot authenticate.
- Destructive tools cannot execute without a matching single-use confirmation.
- No reusable Google token is plaintext in the production database.
- Web login grants identity scopes only; Sheets access has a separate connection.
- Completed account deletion removes all owned rows and R2 objects.
- Production installs are frozen to a committed lockfile and high advisories fail
  CI.
- Security headers are visible on live HTML and API responses.
- Private API responses are non-cacheable and audio access is private and expiring.
- Migration execution is not a public application capability.
- Public request bodies and rates are bounded before expensive processing.

## Explicit non-goals

- No enterprise command bus, generic repository layer, or policy framework.
- No attempt to make provider calls transactionally atomic with PostgreSQL.
- No claim that CSP replaces output encoding, ownership checks, or CSRF defense.
- No indiscriminate rotation of every secret. Rotate credentials whose exposure or
  previous handling gives a concrete reason, and invalidate old sessions during the
  session migration.
