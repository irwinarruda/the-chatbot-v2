---
name: browser-test-local-production
description: Deploy the current uncommitted The Chatbot working tree to an isolated Vercel deployment using production configuration, authenticate with PRODUCTION_WEB_AUTH_TOKEN from .env.production, and verify it in the Codex in-app browser without changing the production domain. Use when the user asks to browser-test local or uncommitted code on Vercel without committing or pushing.
---

# Browser-Test Local Production

Test the exact local working tree on a unique Vercel URL. Keep the canonical
production domain untouched unless the user explicitly requests promotion.

This is a narrow exception to `ship-production`: use this workflow instead of
its commit, push, and commit-SHA waiting steps. Continue to follow its credential
handling and browser-verification rules.

## Safety boundaries

- Treat a request to deploy or browser-test local code as authorization for an
  isolated deployment only. Do not promote it to the production domain without
  explicit authorization.
- Deploy with `--prod --skip-domain`. This uses production configuration while
  preventing automatic production-domain assignment.
- Never stage, commit, or push as part of this workflow.
- Remember that the isolated deployment still uses production services and data.
  Exercise only the requested flow and do not trigger unrelated external or
  destructive side effects.
- Inspect the complete working-tree scope before deployment. Stop if it contains
  a migration or requires an unapplied schema change. Never run production
  migrations merely to browser-test uncommitted code.
- Never use `bun run production:wait`: an uncommitted artifact has no trustworthy
  Git commit identity. Use the unique deployment URL as its identity.

## Preflight

1. Work from the repository root and require `.vercel/project.json` so the target
   project is unambiguous.
2. Inspect the branch, `git status --short`, `git diff --stat HEAD`, the full
   scoped diff, and relevant untracked files. Preserve all user-owned changes.
3. Require the ignored `.env.production` file. Do not print, echo, grep, or paste
   any credential from it.
4. Require `PRODUCTION_WEB_AUTH_TOKEN` through the existing browser-auth helper.
   The helper must validate the saved token and may refresh it with `JWT_SECRET`.
   A missing, expired, or invalid token stops the workflow. Accept the token only
   from `.env.production`, never from a prompt or command-line argument.
5. Run the release checks before uploading:

   ```bash
   bun run check
   bun run typecheck
   bun run test
   ```

Stop on any failed precondition or validation command and report the exact error.

## Deploy the working tree

Run:

```bash
vercel deploy --prod --skip-domain --yes
```

If the installed Vercel CLI fails because Homebrew Node cannot load
`libsimdjson.29.dylib`, retry with the bundled Codex Node runtime first on
`PATH`:

```bash
PATH=/Users/irwinarruda/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
  vercel deploy --prod --skip-domain --yes
```

Record the unique URL returned by Vercel without writing it into a tracked file.
Confirm the exact deployment is ready:

```bash
vercel inspect <deployment-url> --wait
```

Apply the same Node `PATH` fallback if needed. Do not continue when deployment or
inspection fails.

## Authenticate the isolated deployment

Load and follow `browser:control-in-app-browser`. Explicitly select the Codex
in-app browser, read its complete documentation, and create or reuse a dedicated
tab.

Use the existing production helper to read and validate
`PRODUCTION_WEB_AUTH_TOKEN` from `.env.production`. Retarget only the in-memory
cookie URL to the isolated deployment hostname:

```js
if (globalThis.localProductionTab == null) {
  globalThis.localProductionTab = await iab.tabs.new();
}
var localProductionUrl = new URL("<deployment-url>");
await localProductionTab.goto(localProductionUrl.href);
var localProductionAuthModule = await import(
  `file://${nodeRepl.cwd}/.agents/skills/ship-production/scripts/create-browser-auth-cookie.mjs`,
);
var localProductionAuth =
  await localProductionAuthModule.createProductionWebAuthCookie();
localProductionAuth.url = new URL("/", localProductionUrl).href;
localProductionAuth.cookie.url = localProductionAuth.url;
var localProductionCdp =
  await localProductionTab.capabilities.get("cdp");
var localProductionAuthResult = await localProductionCdp.send(
  "Network.setCookie",
  localProductionAuth.cookie,
);
localProductionAuth.cookie.value = "";
if (localProductionAuthResult?.success !== true) {
  throw new Error("The isolated deployment browser cookie could not be installed");
}
await localProductionTab.goto(
  new URL("/chat", localProductionUrl).href,
);
```

Never emit the auth object, cookie, token, environment contents, or CDP command
parameters. Do not inspect browser cookies, storage, or profiles.

## Verify

- Start from a fresh DOM snapshot and confirm authenticated visible app state.
- Exercise the exact requested behavior on the unique deployment URL.
- Check relevant console errors and persisted visible results.
- Check desktop and mobile viewports for visual changes.
- Do not substitute the canonical production domain during this test.

Leave the isolated deployment unpromoted by default. Do not delete it unless the
user asks.

## Promotion exception

Only when the user explicitly asks to make this uncommitted artifact live, state
that it is not reproducible from Git and promote the exact tested URL:

```bash
vercel promote <deployment-url>
```

Then verify that exact artifact on the canonical production domain. Do not claim
a commit-SHA match for an uncommitted deployment.

## Report

Report the local HEAD SHA, dirty-file scope, validation results, unique deployment
URL, Vercel readiness, browser path and outcome, and whether the production domain
was untouched or explicitly promoted. State that authentication came from the
locally saved `PRODUCTION_WEB_AUTH_TOKEN` and was validated without exposure.
