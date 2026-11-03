---
name: server-service-styleguide
description: Use when writing or changing a backend use case, repository, SQL, transaction, gateway or its test double, AI tool, error translation, or a server or integration test. Also use when the request only says "implement this flow", "add a query", "call this provider" or "add a test for the backend". Not for placement, which belongs to server-architecture.
---

# Server service styleguide

## Services

- A use case is a public method of a cohesive service, one service per lifecycle. No class per command, no command bus, no base service. Split a service when two lifecycles make each other hard to follow, as `chat` splits delivery, context, commands, the agent loop and inbound messaging.
- Order: validate, load through repositories, let the domain decide, write through repositories, then effects.
- A service receives everything in its constructor. There is no container; `server.ts` wires by hand.
- A service never runs SQL, reads the environment, or imports `node:*`. Time and randomness that tests must control arrive as constructor arguments.
- A service decides the atomicity boundary. When several repository writes must succeed together, it opens `database.transaction((sql) => ...)` and hands `sql` to each repository method.

## Repositories

- One repository per aggregate, named for it: `UserRepository`, `ChatRepository`. No generic repository, DAO or base CRUD class.
- A repository owns the SQL for its tables, restores entities through their `restore` path, and keeps `Db*` row interfaces private at the bottom of the file.
- Methods that may join a transaction take an optional `sql: DatabaseGatewaySql = this.database.sql` last.
- Convert `undefined` to SQL `NULL` with `?? null` at the query, and back with `?? undefined` when restoring.
- When restoring needs another module's data (a todo's source message), the repository returns plain records and the service attaches the rest.
- Create migrations only with `bun run migrate:create -- <name>`, then edit the generated file.

## Gateways

- Every external thing has a gateway: the interface in `gateways/<name>.ts`, the real one in `<mechanism>.<name>.ts`, the test double in `test.<name>.ts`. Provider-private helpers sit beside the real one with the same mechanism prefix (`pi.message-mapper.ts`).
- The real gateway owns authentication, SDK setup, provider types, protocol retries and the mapping from a provider failure to an application error. It never owns workflow order or another module's SQL.
- Production never reads a flag to switch gateways. Only the composition root chooses.

## Errors

`ValidationException` and other domain errors come from entities and services; `AppError` subclasses (`NotFoundException`, `UnauthorizedException`, ...) carry HTTP meaning; the error middleware maps them to the `ApiError` contract. Catch only to translate, compensate, clean up or fall back, never to log and rethrow.

## Tests

Levels, cheapest first:

1. `tests/server/<module>/`: services, tools and utils with deterministic fakes, no PostgreSQL.
2. `tests/integration/<module>/`: SQL, migrations, transactions, hydration and concurrency against PostgreSQL through `orquestrator` in `tests/support/orchestrator.ts`, which builds the real graph with `createServer` and test gateways.

A fake implements the production interface and nothing more. Never let a test select a live provider. Always `await expect(...).rejects`; an unawaited one passes silently. Integration tests run serially and own their schema reset.

## Working references

- `src/server/modules/todos/services/todo.service.ts` with `repositories/todo.repository.ts`: a service over a repository, hydrating across modules.
- `src/server/modules/identity/services/auth.service.ts`: a service-owned transaction across two repositories.
- `src/server/modules/cash-flow/controllers/cash-flow.tools.ts`: tools that parse a contract and call services.

## Checklist

1. A new external call goes through a gateway, with a test double.
2. A new query goes in the owning repository; the service has no SQL.
3. The test proves the rule through a public method, at the cheapest level that can.
