# AGENTS.md

## Commands

- `bun run dev` — start dev server (defaults to `--mode development`, port 3000)
- `bun run test` — run tests (uses `.env.test` automatically)
- `bun run test:coverage` — run tests with coverage (uses `.env.test` automatically)
- `bun run typecheck` — `tsc --noEmit`
- `bun run check` — biome lint + format check
- `bun run format:fix` — auto-fix formatting with biome
- `bun run lint:fix` — auto-fix lint issues with biome
- `bun run migrate:create` — create a new migration (`bun run migrate:create -- <name>`)
- `bun run migrate:up` / `bun run migrate:down` — run migrations
- `bun run production:wait [commit]` — wait for that exact commit on Vercel
- `bun run migrate:production:status` — list pending production migrations
- `bun run migrate:production:up` — apply and verify production migrations

Use `bun` as the package manager (not npm or yarn).

Always create migration files with `bun run migrate:create -- <name>`, then
edit the generated file. Never create a migration file manually or invent its
timestamp/filename.

## Git

All commit messages MUST follow the Conventional Commits specification. Use
`<type>(<scope>): <description>` when a scope is useful, or
`<type>: <description>` otherwise. Never create a non-conventional commit.

## Environment System

Two-layer env loading is handled by the Vite/Vitest configs and infra scripts:

1. `.env` is always loaded first (base template with placeholders)
2. `.env.${mode}` is loaded with override

Valid modes: `development`, `test`, `preview`, `production`. `bun run dev` defaults to `--mode development` and Vitest defaults to `--mode test`.

Production delivery scripts always load `.env` followed by `.env.production`.
Keep `PRODUCTION_WEB_AUTH_TOKEN` and every other credential only in the ignored
`.env.production` file. Never print, commit, or paste those values into a prompt.

## Production Delivery

Load `ship-production` whenever a task includes pushing to `main`, waiting for a
Vercel production deployment, running production migrations, or verifying the
deployed application in the Codex in-app browser. Follow its workflow in order;
do not inspect the web UI until `production:wait` confirms the exact pushed
commit.

## Testing

Tests run serially (`fileParallelism: false`) with a 30s timeout. Entity, Service, and DTO tests must stay deterministic and infrastructure-free. PostgreSQL integration tests own their schema reset/migration lifecycle and require a running test database.

Use the narrowest test level that proves the behavior:

- Entity tests cover entity/value-object invariants and transitions without DI or PostgreSQL.
- Service tests cover workflows with deterministic gateway/client-service fakes.
- DTO tests cover owned HTTP/SSE schemas and HTTP/client mapping.
- Integration tests cover PostgreSQL, migrations, transactions, hydration, optimistic concurrency, and concrete provider mapping where valuable.

Do not add route implementation tests when a DTO or Service test proves the owned behavior more directly. Do not start PostgreSQL for entity, client-state, or provider-independent Service behavior.

## Project Skills

Load the project skill that owns the decision before changing code:

- `app-architecture` — feature ownership, module placement, DDD/OOP, dependency direction, cross-module coordination, and overall application shape.
- `app-service-boundaries` — HTTP/SSE contracts, Services, gateways, providers, AI tools, SQL, transactions, errors, and dependency composition.
- `app-coding-styleguide` — non-visual TypeScript/JavaScript style, naming, DTOs, imports, whitespace, comments, and locality.
- `client-state-management` — URL/Zustand/local state, async actions, optimistic state, realtime reduction, browser lifecycles, and SSR hydration.
- `client-jsx-styleguide` — React/TSX, terminal visual system, shared UI primitives, layout, responsive behavior, accessibility, and interaction design.
- `app-tests` — Vitest/PostgreSQL test levels, placement, harnesses, fakes, fixtures, assertions, and integration policy.
- `ship-production` — direct `main` publishing, exact Vercel deployment waiting, production migrations, browser authentication, and deployed UI verification.

Use multiple skills when a change crosses concerns. Local project skills take precedence over generic preferences.

## Generated Files

`*.gen.ts` files (including `src/routeTree.gen.ts`) are auto-generated and gitignored. Do not edit them manually.
