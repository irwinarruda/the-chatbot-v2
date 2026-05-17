# AGENTS.md

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

For frontend state and UI orchestration, use a slice architecture as the application layer / view model layer. Slices should coordinate UI state, call services, shape data for consumption by components, and hold application-facing behavior.

Services should act as repositories and integration boundaries. They are responsible for communicating with external resources such as APIs, persistence layers, and browser-provided resources when needed. Keep that infrastructure and resource access inside services rather than inside slices or components.

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

Inside functions and other scopes, do not leave empty lines between statements that belong to the same scope. Do not add blank lines inside `if`, `else`, `switch`, loops, `try/catch`, object literals, array literals, or slice/store definitions just for visual spacing. Use empty lines only between distinct top-level scopes such as separate functions, methods, class members, or clearly separated groups inside React components.

Keep consecutive constant declarations together with no blank lines between them. In React components, a single empty line is acceptable between grouped concerns such as constant declarations, local function declarations, and hook blocks like `useEffect`, `useCallback`, and `useMemo`. Treat those hook groups like distinct scopes or class methods for spacing purposes, but do not add blank lines within a single group.

For event handler functions, prefer naming them `on{Event}` instead of `handle{Event}`.

In React components, keep the order `variables -> functions -> useEffect` whenever practical. Prefer placing `useEffect` calls after local function declarations when it does not conflict with other constraints.

For conditional JSX, prefer `{condition && <Component />}` over `{condition ? <Component /> : null}` when there is no meaningful else branch. Make sure the condition resolves to a boolean so React does not render unintended values such as `0` or a string.

In Zustand stores, never access state with `get().someVariable`. Always destructure the value from `get()` first.

## Generated Files

`*.gen.ts` files (including `src/routeTree.gen.ts`) are auto-generated and gitignored. Do not edit them manually.
