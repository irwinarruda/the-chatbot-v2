# Favo Architecture And Theme Plan

## Goal

Bring The Chatbot onto the architecture of favo-cli, the owner's reference project, and enforce it with a test and a set of skills so it stays that way. Replace the green terminal palette with the owner's Favo theme (Honey dark, Wax light) through shadcn semantic tokens.

## Context

Before this change the backend was a modular monolith with its client nested inside each module (`src/modules/<m>/client`), every HTTP controller in `src/shared/http/controllers`, SQL inside services (`MessagingService` was 1,628 lines), a 756-line `AiToolService` that imported every feature, and a hidden cycle: identity called chat through a coordinator interface wired lazily in `infra/bootstrap.ts`. The architecture test could not see the cycle because it went through an interface.

favo-cli splits pure `domain` and `contracts` packages from `server` and `client` apps, gives each server module `controllers/services/repositories/gateways/utils`, ranks modules by level, keeps one hand-written composition root, and enforces all of it with an import-table test.

## Steps

1. Split `src` into `domain`, `contracts`, `server` and `client` with a scripted move that rewrote every import. Module barrels removed.
2. Server: one repository per aggregate holds all SQL; services keep the rules. `MessagingService` became chat delivery, context, commands, the agent loop and inbound messaging. Each module owns its AI tools as controllers (`<m>.tools.ts`), composed into one `ToolExecutor` in `server.ts`. A new `accounts` module (level 4) owns sign-in and account deletion, which removed the identity-chat cycle. `createServer(config, gateways, options)` receives every gateway; only `production.ts` reads the environment.
3. Client: modules use `app/{services,repositories,gateways}`, `parsers/`, `screens/<Name>/index.tsx`, one flat store composed in `shared/stores/app.ts`.
4. `tests/architecture.test.ts` enforces the layer table, module levels, a pure domain and contracts, the client view and app boundaries, no comments, no `../`, no enums and no hard-coded colors.
5. Skills rewritten in favo's shape and naming; `AGENTS.md` maps paths to skills.
6. Favo theme through shadcn tokens, with the hue-named `term-*` classes replaced by roles. The logo keeps its shape and takes the honey color.

## Deliberate differences from favo-cli

- One TanStack Start app with folders, not a Bun workspace: Vercel deploys one Vite build, and the folders give the same boundaries.
- Entities stay classes with `restore`, because chats, messages and credentials carry identity and transitions. favo uses zod objects.
- Controllers read `getServer()`: TanStack file routes cannot receive dependencies, so one lazy production accessor is the framework edge.
- Repositories take an optional transaction handle and services decide the atomicity boundary. favo stores files and has no transactions.
- Gateway and repository ports are TypeScript interfaces, not abstract classes; nothing needs them at runtime.
- No client DI container or `mockDb`: there is one composition (`shared/stores/app.ts`), and tests pass fakes to service creators. Add a container when a mock mode is wanted.
- Entities still stamp their own timestamps and ids; new rules take time as an argument.

## Risks

- Every import path changed, so open branches will conflict. There are none besides this one.
- Production behavior must not change. The full PostgreSQL suite and the UI suite cover the moved code; the sign-in flow now sends its confirmation from `AccountsService` after the identity transaction, in the same order as before.

## Validation

`bun run check`, `bun run typecheck`, `bun run test` and `bun run test:ui` pass locally and in CI. Screenshots of the main screens in both Favo variants are reviewed before merge.
