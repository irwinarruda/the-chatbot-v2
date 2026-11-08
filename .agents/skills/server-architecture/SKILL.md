---
name: server-architecture
description: Always load for any change under src/server: adding or changing a module, controller, AI tool, service, repository, gateway or the composition root, or deciding where backend code belongs and what it may import. Also use when the request only says "add an endpoint", "add a tool", "call this API" or "where does this go". Not for src/client.
---

# Server architecture

## Authority

This skill owns placement and dependency direction in `src/server`. How services, repositories and gateways are written comes from `server-service-styleguide`. Entities and rules come from `domain-styleguide`; wire shapes and AI tool inputs from `contracts-styleguide`.

## Module template

```text
src/
  routes.ts        TanStack virtual route table: page routes and controllers
  start.ts         request and function middleware
  server/
    server.ts      composition root: createServer(config, gateways, options) wires every service by hand
    production.ts  the real gateways and getServer(); the only reader of the environment
    shared/        level 0: config, database, errors, gateways (cross-module ports), http
    modules/<m>/
      controllers/ <path>.controller.ts: one TanStack server route per URL
                   <m>.tools.ts: the module's AI tools
      services/    <capability>.service.ts: every application rule
      repositories/<aggregate>.repository.ts: SQL for the tables this module owns
      gateways/    <name>.ts interface, <mechanism>.<name>.ts real, test.<name>.ts double
      utils/       stateless helpers
```

Add only folders with a real role.

## Modules and levels

| Level | Module                                            | Owns                                                                                          |
| ----- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1     | `system`                                          | health status, migrations                                                                     |
| 2     | `identity`                                        | users, Google credentials and OAuth, web tokens                                               |
| 3     | `chat`                                            | chats and messages, the AI agent loop, slash commands, delivery to WhatsApp and web, the tool executor |
| 4     | `accounts`                                        | flows that change identity and chat together: WhatsApp and web sign-in, sign-out, account deletion |
| 4     | `artifacts`, `cash-flow`, `notes`, `todos`        | features; each exposes its own AI tools                                                       |

A module imports only lower levels. When a flow must change two modules, it lives in a higher module that calls both, the way `accounts` calls `identity` and `chat`. Never pass a callback, coordinator or lazy reference down to dodge a cycle.

## Import rule

| Folder          | May import                                                                                                  | Never                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `controllers/`  | services, `shared/`, `production.ts`, domain, contracts                                                     | repositories, gateways, utils                 |
| `services/`     | services, repositories, gateway interfaces, utils, `shared/{config,errors,gateways}`, the database gateway, domain, contracts | a gateway implementation, `node:*`, SQL, the environment |
| `repositories/` | gateway interfaces, utils, the database gateway, `shared/config`, domain                                     | services, controllers                         |
| `gateways/`     | gateways, utils, `shared/{config,errors}`, the database gateway, domain, contracts                           | services, repositories, controllers           |
| `utils/`        | utils, `shared/{config,errors}`, domain, contracts                                                          | everything else                               |

`tests/architecture.test.ts` fails on a violation, on an upward module import, on SQL or `node:*` in a service, on an environment read outside `production.ts`, on `production.ts` imported away from the HTTP edge, and on a gateway implementation without its interface. Change the test and this table together.

## The edge

- A controller parses the request with a contract schema, calls one service capability, and maps the result with a contract mapper. TanStack file routes, middleware and server functions cannot receive dependencies, so controllers, `shared/http/middleware` and `shared/http/functions` read `getServer().services`; nothing else imports `production.ts`, and the architecture test enforces it.
- An AI tool is a controller for the model. Each module exports `create<Module>Tools(...)` returning `RegisteredTool[]` from `controllers/<m>.tools.ts`; `server.ts` concatenates them into the one `ToolExecutor` the chat agent runs. Chat never imports a feature module. The calls of one model response run together, four at a time, when they are all read-only or all marked `isParallelSafe` (writes that only append, like `add_transaction`); any other mix runs in call order, so a read sees the writes before it. A parallel-safe tool wraps its write in `context.inCallOrder` so the rows land in the order the model sent them. A tool's `afterRound` runs once after the round, within five seconds, and adds its data to each of that tool's succeeded results, as the cash-flow records do with the balances.
- A new URL is a controller file plus one `route(...)` line in `src/routes.ts`.
- Server functions that page routes call live in `shared/http/functions/`; they are the only server code the client may import.

## Working references

- `src/server/modules/todos/`: the layered module end to end, including its tools.
- `src/server/modules/chat/gateways/`: interfaces with real and test implementations side by side.
- `src/server/modules/accounts/`: a higher module orchestrating two lower ones.
- `src/server/server.ts` and `src/server/production.ts`: the composition root.

## Checklist

1. Each new file sits in the folder its role names, named `<name>.<role>.ts` in kebab-case.
2. `bun run test:unit` passes, including the architecture test.
