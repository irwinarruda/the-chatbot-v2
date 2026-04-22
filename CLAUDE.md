# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is a TypeScript rewrite of the parent C# project at the repo root. The `AGENTS.md` in the repo root is scoped to `*.cs` files and does not apply here.

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

## Architecture

The codebase follows a Controller → Service → Entity layered pattern with a custom DI container (`infra/container.ts`). Dependency wiring for production lives in `infra/bootstrap.ts`.

- `src/entities/` — domain objects (User, Chat, Message, etc.)
- `src/services/` — business logic
- `src/resources/` — gateway interfaces + implementations (external API clients)
- `src/routes/` — TanStack Start API routes (`api/v1/*`)
- `infra/` — config, database, container, migrations, exceptions
- `src/utils/` — mediator, loaders, WhatsAppTextChunker

## Environment System

Two-layer env loading is handled by the Vite/Vitest configs and infra scripts:

1. `.env` is always loaded first (base template with placeholders)
2. `.env.${mode}` is loaded with override

Valid modes: `development`, `test`, `preview`, `production`. `bun run dev` defaults to `--mode development` and Vitest defaults to `--mode test`.

## Testing

Tests run serially (`fileParallelism: false`) with a 30s timeout. The `Orquestrator` class in `tests/orquestrator.ts` handles DI wiring and **wipes the entire database schema** before each test file (`DROP SCHEMA public CASCADE` → recreate → run migrations). Tests require a running PostgreSQL instance.

Only application tests are allowed in the Vitest suite: tests for Services, Entities, and Utils. Do not add route, controller, middleware, gateway/resource, or infra-focused tests to the default test run.

## Code Style

Biome enforces: 2-space indent, double quotes, semicolons always, trailing commas, 80 char line width. `noExplicitAny` is disabled.

Within a class, keep logic inline by default. Do not split logic into helper private methods just to make the class look smaller. Extract a separate method only when the same logic is reused more than once in that class.

## Generated Files

`*.gen.ts` files (including `src/routeTree.gen.ts`) are auto-generated and gitignored. Do not edit them manually.
