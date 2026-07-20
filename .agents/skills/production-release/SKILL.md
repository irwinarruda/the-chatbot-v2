---
name: production-release
description: Deploy and release the exact current The Chatbot working tree—including branch-only commits, staged, unstaged, and untracked changes—through an isolated production-configured Vercel candidate, browser-test that artifact, and promote it to the canonical production domain without requiring a commit or push. Use whenever the user asks to test local code against production, deploy, ship, release, promote, roll back, inspect or apply production migrations, wait for Vercel, or verify the live The Chatbot app. This skill owns both code-only and database-changing releases and must enforce the database safety gate before production data or domains change.
---

# Production Release

Release the exact local artifact, not a Git approximation of it:

1. inspect and classify the complete local source;
2. deploy it as a production-configured candidate without assigning domains;
3. verify that exact candidate;
4. promote that same deployment;
5. verify the canonical production domain.

Do not stage, commit, push, merge, or switch branches unless the user separately
asks for Git delivery. A branch name and commit SHA are useful context, but the
deployment URL is the identity of an uncommitted artifact.

## Interpret the request

- “Test/deploy my local changes in production” authorizes creating and testing the
  isolated candidate. It does not by itself authorize changing the canonical
  production domain.
- “Ship/release/promote/make it live/deploy to production” authorizes promotion
  after the candidate passes its safety gate and browser verification.
- “Apply/run the migration” authorizes the planned production migration step. A
  general request to test code does not.
- Never infer permission to commit or push from production-release permission.

## Hard safety classification

Classify every candidate before deployment. When uncertain, use
`database-change`.

### `code-only`

Use this class only when all of these are true:

- no migration is added, modified, renamed, or removed by branch commits or the
  working tree;
- the candidate does not require schema absent from the current production
  database;
- testing it cannot destructively rewrite or reinterpret durable production data;
- writes made by the candidate remain readable by the currently live artifact and
  the rollback artifact;
- no irreversible provider, credential, storage, queue, or environment cutover is
  hidden outside `infra/migrations`.

This is the fast path. It may use the production database during isolated testing,
then promote the tested artifact. Rollback is normally a domain reassignment to the
previous deployment.

### `database-change`

Use this class when a migration exists, schema compatibility is involved, durable
data changes meaning, or the code-only claims cannot be proven. “No migration file”
does not override semantic database risk.

Before passing `--database-ready`, prove that the product is release-complete:

- the full intended diff is present with no known unfinished behavior;
- standard checks and every relevant integration/UI test pass;
- migration `up`, `down`, and re-`up` behavior is tested locally when rollback is
  supported;
- data preservation is asserted for important user data;
- the change is classified as expand, contract, or direct breaking cutover;
- the exact order keeps the current and candidate applications compatible at each
  production step;
- rollback or roll-forward is written down, including backup/restore when the
  previous application will not remain compatible;
- every required secret and encryption key is already available and retained.

Prefer an expand/contract sequence. A direct breaking cutover cannot honestly be
pretested against the production database without changing shared state. Stop and
ask for explicit downtime/cutover authorization after proving a recoverable backup;
do not disguise that path as the normal fast release.

## Use the bundled helper

Run commands from the repository root:

```bash
bun run production:release doctor
bun run production:release inspect
```

`doctor` validates local configuration and browser credentials without printing
secrets. `inspect` reports branch, HEAD, source fingerprint, complete changed-file
scope, and detected migration paths. Read the actual diff after it; the helper
cannot prove semantic safety.

Deploy only after manually agreeing with the class:

```bash
bun run production:release deploy --class code-only
```

For a database-changing release, pass the acknowledgment only after completing the
database gate:

```bash
bun run production:release deploy \
  --class database-change \
  --database-ready
```

The deploy command runs `bun run check`, `bun run typecheck`, and `bun run test`,
deploys with production configuration and `--skip-domain`, waits for readiness,
and stores a candidate manifest inside `.git`. It records the previous production
deployment and fingerprints the exact local source. It never commits, pushes, or
promotes.

Run extra checks that the change specifically needs before browser verification,
such as `bun run test:ui` for UI behavior.

## Database release ordering

The helper can query or apply migrations through the exact candidate URL. It reads
credentials from ignored `.env.production`, adds Vercel's automation-bypass header
in memory, and never prints the values.

```bash
bun run production:release migrations status
bun run production:release migrations up \
  --database-ready
```

Default migration target is the saved candidate. Use `--target production` only
when the release plan requires the canonical deployment.

- Expand: deploy the compatible candidate, apply the additive migration through
  that candidate, verify both the still-live app and candidate, then promote.
- Contract: verify and promote code that no longer needs the old schema, apply the
  contract migration, then verify again.
- Direct breaking cutover: require explicit authorization and a tested backup plus
  roll-forward plan. Expect a maintenance window unless a multi-artifact transition
  removes the incompatibility.

Never apply a migration from a candidate until its pending names are known, the
candidate contains those exact local files, and the current live application is
compatible with the resulting database state.

## Browser-test the exact candidate

Load and follow `browser:control-in-app-browser` and the active environment's
in-app-browser instructions. Use the saved candidate URL, not the canonical domain.

The ignored `.env.production` must contain:

- `PRODUCTION_WEB_AUTH_TOKEN` for application authentication;
- `JWT_SECRET` when the saved app token needs safe refresh;
- `VERCEL_AUTOMATION_BYPASS_SECRET` so automation can reach protected unique
  deployment URLs;
- `AUTH_HASH_PASSWORD` before applying production migrations.

The one-time Vercel automation-bypass secret must be configured in Vercel and copied
to `.env.production` by the user. Never request it in chat or print it. The app auth
cookie and Vercel protection bypass are separate layers.

Use `scripts/create-browser-auth-cookie.mjs` in the browser runtime to validate or
refresh the app token and install its returned HttpOnly cookie through the browser's
documented cookie/CDP capability. Install the Vercel bypass through the browser's
documented header or bypass-cookie flow. Clear in-memory secret values immediately
after use. Never inspect browser cookies, storage, profiles, or environment contents.

Verify visible authenticated state, the exact changed workflow, relevant console
errors, persisted results, and desktop/mobile layouts for UI work. Read-only API or
CLI checks support this evidence but do not replace browser verification.

If candidate verification is blocked, stop. Do not promote merely because Vercel
reports `Ready`.

## Promote and verify

When promotion was authorized and the exact candidate passed:

```bash
bun run production:release promote
```

For a database-changing candidate, also pass `--database-ready`. The helper refuses
source drift, promotes only the URL in the saved manifest, and verifies that the
canonical domain resolves to that exact deployment.

Then browser-test the canonical domain again. Check production migration status and
prove the durable result, not merely a success toast.

## Rollback

For a code-only release, the helper remembers the previous production deployment:

```bash
bun run production:release rollback
```

For a database-changing release, code rollback is blocked unless
`--database-compatible` is supplied after proving the previous code still supports
the current schema and data. Otherwise roll forward or execute the tested database
restore/down plan. A Vercel rollback does not roll back PostgreSQL.

## Report

Report these as separate facts:

- branch, local HEAD, local `origin/main` baseline, dirty/untracked scope, and
  source fingerprint;
- release class and the evidence supporting it;
- validation commands and exact outcomes;
- candidate URL and readiness;
- candidate browser path and observed result;
- pending/applied production migrations and data-preservation checks;
- promoted deployment identity or confirmation that production stayed untouched;
- canonical browser path and observed result;
- rollback target and whether database rollback remains safe.

Never claim a Git SHA identifies an uncommitted deployment. Never claim production
success when only build readiness, API reachability, or an authentication wall was
observed.
