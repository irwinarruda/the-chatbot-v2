# AGENTS.md

The Chatbot is a personal assistant that lives in WhatsApp and on the web. One TanStack Start app: `src/domain` and `src/contracts` are pure and shared by both sides, `src/server` is the backend, `src/client` is the React web app, and `src/routes.ts` maps every URL to a page route or a controller. The layout follows favo-cli; `.agents/plans/019-favo-architecture-and-theme.md` explains why.

## Commands

Use `bun` as the package manager (not npm or yarn).

- `bun run dev` starts the dev server (`--mode development`, port 3000).
- `bun run dev:mock` runs only the web app, on demo data, at port 3300: no backend, database, credentials or sign-in. Use it to work on the UI or to see a screen.
- `bun run screenshots [scene...]` retakes the README pictures into `docs/assets`.
- `bun run test` runs every test against the local PostgreSQL (`.env.test`); `bun run test:unit` runs everything that needs no database; `bun run test:ui` runs the jsdom view tests.
- `bun run test:coverage` runs the suite with coverage.
- `bun run typecheck` generates routes and runs `tsc --noEmit`.
- `bun run check` is Biome lint and format; `bun run check:fix` applies fixes.
- `bun run migrate:create -- <name>` creates a migration; `bun run migrate:up` and `bun run migrate:down` run them.
- `bun run production:release <command>` inspects, deploys, migrates, promotes or rolls back the exact current working-tree artifact.
- `bun run production:wait [commit]` waits for that exact commit on Vercel.
- `bun run migrate:production:status` lists pending production migrations; `bun run migrate:production:up` applies and verifies them.

Always create migration files with `bun run migrate:create -- <name>`, then edit the generated file. Never create a migration file manually or invent its timestamp or filename.

## Working agreements

- `src/domain` is pure: no I/O, no framework, no environment.
- Every external thing on the server goes through a gateway with a test double beside it. Only `src/server/production.ts` reads the environment and builds real gateways.
- Services hold the rules; repositories hold the SQL; controllers and AI tools only parse, call one service and map.
- A server module imports only lower levels; a flow that changes two modules lives in a higher one.
- On the client, views call Zustand services, services call repositories and gateways. Everything under `app/` knows nothing about React.
- Colors come from the theme tokens in `src/client/shared/styles/tailwind.css`, never from a literal.
- No comments in production code. No `../`. No barrels. No TS `enum`. `undefined`, never `null`, outside SQL and protocol boundaries.
- `tests/architecture.test.ts` enforces the structural rules above. Change it together with the skill that owns the rule.

## Completion gate

`bun run check`, `bun run typecheck`, `bun run test` and `bun run test:ui` must pass before you say something works. CI runs the same commands. Running against production is a separate check and is reported separately.

## Production constraints

This project is used in production by one person. Backward compatibility is not required, so prefer direct migrations and refactors over compatibility layers. Never lose important user-specific data. Disposable state is fine to drop: sessions, auth tokens and hashes, connection state and similar. Use common sense.

## Git

All commit messages MUST follow the Conventional Commits specification. Use `<type>(<scope>): <description>` when a scope is useful, or `<type>: <description>` otherwise. Never create a non-conventional commit.

Never add `Co-authored-by`, `Co-Authored-By`, or any other co-author trailer to commits when acting as an agent. Commit messages must not attribute the agent as a co-author.

## Biome

Keep `biome.json` independent of the Biome version: no nursery rules, because a
release can rename one and an unknown key stops every Biome command. Keep the
`$schema` local to `node_modules` and `files.includes` an allowlist of file
types, so a release cannot start reformatting new ones. Markdown stays excluded
because `templates/prompts/*.md` are sent to the models verbatim.

## Environment

Env loading has two layers, applied by the Vite and Vitest configs and the infra scripts: `.env` is always loaded first, then `.env.${mode}` overrides it. Valid modes are `development`, `mock`, `test`, `preview` and `production`; `.env.mock` and `.env.test` are tracked and hold no secrets. `bun run dev` defaults to `--mode development` and Vitest to `--mode test`.

Production delivery scripts always load `.env` followed by `.env.production`. Keep `PRODUCTION_WEB_AUTH_TOKEN` and every other credential only in the ignored `.env.production` file. Never print, commit, or paste those values into a prompt.

## Production delivery

Load `production-release` whenever a task includes testing local or branch code with production configuration, deploying or promoting a Vercel production artifact, running production migrations, rolling production back, or verifying the deployed application in a browser. It deploys the exact current working tree as an isolated candidate before promotion and does not require a commit or push. Follow its database safety classification and exact-artifact workflow in order.

## Skills

Load the skills that govern the paths a task touches:

| Path                                   | Skills                                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Any TypeScript                         | `coding-styleguide`                                                                                                          |
| `src/domain`                           | `domain-styleguide`                                                                                                          |
| `src/contracts`                        | `contracts-styleguide`                                                                                                       |
| `src/server`, `src/routes.ts`          | `server-architecture` always, plus `server-service-styleguide` for services, repositories, gateways, tools and server tests  |
| `src/client`                           | `client-architecture` always, plus `client-service-styleguide` for services, repositories and the store, `client-jsx-styleguide` for views and styling, and `client-tests` for tests |
| A new file in `.agents/plans`, `.agents/specs` or `.agents/promts` | `plan-creator-guide`                                                                             |
| `src/client/mock`, `docs/assets/*.png`, the README's pictures | `readme-screenshots`                                                              |
| Deploying or verifying production      | `production-release`                                                                                                         |

Skills that govern one side carry its prefix (`server-`, `client-`, `domain-`, `contracts-`). Skills that span sides have no prefix. A `-styleguide` skill says how one layer's code is written; an `-architecture` skill says where things live and which way dependencies point.

## Published skills

`.agents/skills` is for working on this repository. `skills/` is what the project ships to its users: `.claude-plugin/marketplace.json` publishes that folder as the `the-chatbot` plugin. `skills/the-chatbot-artifact` is the client of the artifacts module, so change it in the same commit as what it mirrors: the allowed HTML and code languages, the design tokens, `ARTIFACT_MAX_SOURCE_BYTES`, the upload token format, the `/api/v1/artifacts` endpoints, and the config path the Artifacts page shows.

## Generated files

`*.gen.ts` files (including `src/routeTree.gen.ts`) are auto-generated and gitignored. Do not edit them manually.
