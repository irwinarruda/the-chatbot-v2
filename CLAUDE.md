# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

This is a TypeScript rewrite of the parent C# project at the repo root. The `AGENTS.md` in the repo root is scoped to `*.cs` files and does not apply here.

## Commands

- `bun run dev` — start dev server (defaults to MODE=local, port 3000)
- `bun run test` — run tests (uses `.env.test` automatically via `NODE_OPTIONS='--import tsx/esm'`)
- `bun run typecheck` — `tsc --noEmit`
- `bun run check` — biome lint + format check
- `bun run format:fix` — auto-fix formatting with biome
- `bun run lint:fix` — auto-fix lint issues with biome
- `bun run migrate:create` — create a new migration (`bun run migrate:create -- <name>`)
- `bun run migrate:up` / `bun run migrate:down` — run migrations

Use `bun` as the package manager (not npm or yarn).

## Architecture

The codebase follows a Controller → Service → Entity layered pattern with a custom DI container (`src/infra/container.ts`). Dependency wiring for production lives in `src/infra/bootstrap.ts`.

- `src/entities/` — domain objects (User, Chat, Message, etc.)
- `src/services/` — business logic
- `src/resources/` — gateway interfaces + implementations (external API clients)
- `src/routes/` — TanStack Start API routes (`api/v1/*`)
- `src/infra/` — config, database, container, env, migrations, exceptions
- `src/utils/` — mediator, loaders, WhatsAppTextChunker

## Environment System

Two-layer env loading (see `src/infra/env.ts`):

1. `.env` is always loaded first (base template with placeholders)
2. `.env.${MODE}` is loaded with override

Valid modes: `local`, `development`, `test`, `preview`, `production`, `tui`. MODE defaults to `local`. NODE_ENV is derived from MODE — do not set it independently.

## Testing

Tests run serially (`fileParallelism: false`) with a 30s timeout. The `Orquestrator` class in `tests/orquestrator.ts` handles DI wiring and **wipes the entire database schema** before each test file (`DROP SCHEMA public CASCADE` → recreate → run migrations). Tests require a running PostgreSQL instance.

## Code Style

Biome enforces: 2-space indent, double quotes, semicolons always, trailing commas, 80 char line width. `noExplicitAny` is disabled.

## Generated Files

`*.gen.ts` files (including `src/routeTree.gen.ts`) are auto-generated and gitignored. Do not edit them manually.
