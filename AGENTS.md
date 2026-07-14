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

Use `bun` as the package manager (not npm or yarn).

Always create migration files with `bun run migrate:create -- <name>`, then
edit the generated file. Never create a migration file manually or invent its
timestamp/filename.

## Environment System

Two-layer env loading is handled by the Vite/Vitest configs and infra scripts:

1. `.env` is always loaded first (base template with placeholders)
2. `.env.${mode}` is loaded with override

Valid modes: `development`, `test`, `preview`, `production`. `bun run dev` defaults to `--mode development` and Vitest defaults to `--mode test`.

## Testing

Tests run serially (`fileParallelism: false`) with a 30s timeout. Domain, application, and contract tests must stay deterministic and infrastructure-free. PostgreSQL integration tests own their schema reset/migration lifecycle and require a running test database.

Use the narrowest test level that proves the behavior:

- Domain tests cover entity/value-object invariants and transitions without DI or PostgreSQL.
- Application tests cover workflows with deterministic port/client-service fakes.
- Contract tests cover owned HTTP/SSE schemas and server/client mapping.
- Integration tests cover PostgreSQL, migrations, transactions, hydration, optimistic concurrency, and concrete provider mapping where valuable.

Do not add route implementation tests when a contract or application test proves the owned behavior more directly. Do not start PostgreSQL for domain, client-state, or provider-independent application behavior.

## Project Skills

Load the project skill that owns the decision before changing code:

- `app-architecture` — feature ownership, module placement, DDD/OOP, dependency direction, cross-module coordination, and overall application shape.
- `app-service-boundaries` — HTTP/SSE contracts, Services, ports/adapters, providers, AI tools, SQL, transactions, errors, and dependency composition.
- `app-coding-styleguide` — non-visual TypeScript/JavaScript style, naming, contracts, imports, whitespace, comments, and locality.
- `client-state-management` — URL/Zustand/local state, async actions, optimistic state, realtime reduction, browser lifecycles, and SSR hydration.
- `client-jsx-styleguide` — React/TSX, terminal visual system, shared UI primitives, layout, responsive behavior, accessibility, and interaction design.
- `app-tests` — Vitest/PostgreSQL test levels, placement, harnesses, fakes, fixtures, assertions, and integration policy.

Use multiple skills when a change crosses concerns. Local project skills take precedence over generic preferences.

## Generated Files

`*.gen.ts` files (including `src/routeTree.gen.ts`) are auto-generated and gitignored. Do not edit them manually.
