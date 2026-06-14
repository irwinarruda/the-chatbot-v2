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

## Environment System

Two-layer env loading is handled by the Vite/Vitest configs and infra scripts:

1. `.env` is always loaded first (base template with placeholders)
2. `.env.${mode}` is loaded with override

Valid modes: `development`, `test`, `preview`, `production`. `bun run dev` defaults to `--mode development` and Vitest defaults to `--mode test`.

## Testing

Tests run serially (`fileParallelism: false`) with a 30s timeout. The `Orquestrator` class in `tests/orquestrator.ts` handles DI wiring and **wipes the entire database schema** before each test file (`DROP SCHEMA public CASCADE` → recreate → run migrations). Tests require a running PostgreSQL instance.

Only application tests are allowed in the Vitest suite: tests for Services, Entities, and Utils. Do not add route, controller, middleware, gateway/resource, or infra-focused tests to the default test run.

## Generated Files

`*.gen.ts` files (including `src/routeTree.gen.ts`) are auto-generated and gitignored. Do not edit them manually.
