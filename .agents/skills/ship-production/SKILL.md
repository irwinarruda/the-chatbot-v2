---
name: ship-production
description: "Publish The Chatbot changes directly to main, wait for the exact Vercel production deployment, inspect and run pending production migrations through the production API, authenticate the Codex in-app browser from the ignored production env, and verify deployed behavior. Use whenever a task includes pushing or shipping to main, production deployment, Vercel waiting, production migrations, or post-deploy browser verification for the-chatbot.irwinarruda.com."
---

# Ship Production

Ship verified releases through production. Keep the order strict so browser checks
cannot accidentally exercise the previous deployment, and split schema-dependent
work into separate releases when one commit would create a compatibility gap.

## Preconditions

- Work from the repository root on `main` unless the user explicitly requests a
  different delivery path.
- Treat the whole dirty worktree as user-owned. Confirm the intended change set
  before staging and do not include unrelated files.
- Require `.env.production`. It is ignored by git and owns local production
  credentials.
- Require `PRODUCTION_WEB_AUTH_TOKEN` in `.env.production` before authenticated
  browser checks. Never print or echo it.
- Prefer also keeping the production `JWT_SECRET` in `.env.production`. The
  browser helper can then refresh an expired or legacy saved token locally into
  the current issuer, audience, and `purpose: "web-auth"` contract. Without that
  secret, the saved token must still be valid and already use the current contract.

For the one-time user setup, log in manually, copy only the
`__Host-web_auth_token` cookie value into `PRODUCTION_WEB_AUTH_TOKEN` in
`.env.production`, and close the browser developer tools.
`PRODUCTION_WEB_AUTH_TOKEN` remains the local environment variable that stores only
the cookie value. The agent must not inspect browser cookies or perform this
extraction. Keep the same `JWT_SECRET` used by production in that file so later
agents can refresh the saved token without repeating Google login.

## Migration compatibility gate

Decide deployment order before committing whenever the change includes migrations.
The production migration endpoint only sees migrations bundled in the currently
deployed commit, so a pre-deploy status check cannot apply a new local migration.

- If new application code reads or writes new schema, first ship an expand release
  containing the migration and only code that remains compatible with the old
  schema. Wait for that release, apply and verify the migration, then ship the
  application release that depends on it.
- If a migration removes or changes schema used by the current application, first
  ship application code that no longer depends on it. Apply the contracting
  migration in a later release.
- If new writes make the previous application unable to read persisted data, use a
  dual-read/dual-write transition. Treat a roll-forward-only cutover as an explicit
  risk that requires the user's authorization, a recoverable database backup, and
  verified retention of every required encryption key.

Do not accept a temporary production failure between deployment and migration as a
normal release step.

## Delivery workflow

1. Inspect `git status`, the current branch, and the complete scoped diff.
2. Implement the change using the project skills that own it.
3. Run the narrowest relevant tests while iterating, then run:

   ```bash
   bun run check
   bun run typecheck
   bun run test
   ```

4. Re-check the final diff and create a Conventional Commit.
5. Push the current `main` commit to `origin main` only when the user's request
   authorizes production publishing.
6. Capture the full pushed SHA and wait for that exact deployment:

   ```bash
   bun run production:wait -- "$(git rev-parse HEAD)"
   ```

7. Inspect production migrations:

   ```bash
   bun run migrate:production:status
   ```

8. If migrations are pending and the requested production workflow authorizes
   applying them, run:

   ```bash
   bun run migrate:production:up
   ```

   This command verifies pending migration names exist in the checked-out commit,
   applies them through the deployed migration endpoint, and checks that none
   remain. Do not use a direct production database command for this workflow.
9. When this was an expand release, finish and validate the application release,
   then repeat the commit, push, exact-deployment wait, and migration-status checks.
10. Verify the deployed behavior with the Codex in-app browser.

Stop and report the exact failure when validation, push, deployment waiting, or
migration verification fails. Do not continue to browser verification after a
failed prerequisite.

## In-app browser authentication

Load and follow `browser:control-in-app-browser` before browser work. Explicitly
select the Codex in-app browser. Do not substitute Chrome, standalone Playwright,
web search, or `curl` for visual verification.

After browser setup, install the locally saved credential without displaying it:

```js
if (globalThis.productionTab == null) {
  globalThis.productionTab = await iab.tabs.new();
}
var productionAuthModule = await import(
  `file://${nodeRepl.cwd}/.agents/skills/ship-production/scripts/create-browser-auth-cookie.mjs`,
);
var productionAuth =
  await productionAuthModule.createProductionWebAuthCookie();
await productionTab.goto(productionAuth.url);
var productionCdp = await productionTab.capabilities.get("cdp");
var productionAuthResult = await productionCdp.send(
  "Network.setCookie",
  productionAuth.cookie,
);
productionAuth.cookie.value = "";
if (productionAuthResult?.success !== true) {
  throw new Error("The production browser cookie could not be installed");
}
await productionTab.goto(
  new URL("/chat", "https://the-chatbot.irwinarruda.com").href,
);
```

Never write the auth object, token, env contents, or CDP command parameters to
tool output. The helper validates the saved credential and returns only an
in-memory cookie object.

## Browser verification

- Start with a fresh DOM snapshot after navigation.
- Confirm the app is authenticated by visible app state, not by reading cookies
  or browser storage.
- Exercise the exact changed workflow using stable visible locators.
- Inspect browser console errors when relevant.
- Check desktop and mobile viewports for UI changes; load the viewport capability
  documentation before overriding dimensions.
- Prefer observable persisted results over a success toast alone.
- Finalize browser tabs according to the Browser skill. Keep a tab only when it is
  useful to the user as a deliverable.

Report the pushed commit, deployment match, migration result, browser path tested,
and observed outcome. Mention that the in-app browser session cookie was installed
from local production credentials without exposing it.
