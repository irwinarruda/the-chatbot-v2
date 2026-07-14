---
name: app-architecture
description: "Authoritative guide to The Chatbot's feature-oriented modular-monolith architecture, module ownership, folder placement, entities, Services, gateways, DTOs, contracts, client code, and dependency direction. Use whenever planning, creating, moving, reviewing, or refactoring server or client features; changing entities, DTOs, Services, gateways, controllers, tools, SQL ownership, wiring, or cross-module dependencies."
---

# App Architecture

## Source of truth and precedence

The implemented structure under `src/modules`, `src/shared`, and `infra` is the
source of truth.

Precedence:

1. The user's explicit request and the nearest scoped `AGENTS.md`.
2. Implemented ownership and dependency direction.
3. This skill as the default architecture.

Before adding or moving code, answer:

1. Which module owns it?
2. Is it an entity/DTO, Service, gateway, contract mapper, utility, or client concern?

## Purpose

Keep each capability readable end to end without ceremonial layers. Entities protect
state, Services run workflows, gateways isolate external systems, DTOs define data,
and framework code stays thin.

The architecture is a feature-oriented modular monolith with selective DDD and OOP.
Use the smallest structure that preserves ownership and dependency direction.

Load `app-service-boundaries` for HTTP/SSE DTOs, gateways, SQL, transactions,
providers, errors, and composition. Load the client skills for UI or state work.

## Canonical module shape

```text
src/modules/<capability>/
  entities/
    dtos/                 plain DTOs and Zod-backed runtime DTOs
    enums/                closed entity-owned values when needed
    Entity.ts             stateful entities and value objects
  services/               application workflows and persistence
  gateway/
    SomeGateway/
      index.ts            gateway interface and gateway-owned types
      VendorSomeGateway.ts
      TestSomeGateway.ts
  contracts/              DTO/entity-to-boundary mappers; no schemas
  utils/                  feature helpers such as loaders
  client/                 feature-owned browser code
    screens/
    components/
    state/
    services/
    entities/dtos/        browser-only DTOs when they do not belong to the module API
```

Create only directories the module needs. Do not add empty symmetry.

The old `domain/`, `application/`, and `server/` directories are retired. Do not
reintroduce them.

## Folder rules

### Entities and DTOs

`entities/` owns stateful entities, value objects, enums, and the module's data
vocabulary.

All declarations whose names end in `DTO` must live in an `entities/dtos/`
directory. This includes Service inputs, gateway inputs, AI tool inputs, and
browser-only DTOs.

HTTP requests, responses, and SSE events are also DTOs even when their names use
`Request`, `Response`, or `Event`. Put their Zod schemas under the owning module's
`entities/dtos/` directory.

Keep entity code independent of Services, gateways, HTTP, provider SDKs, React,
Zustand, TanStack, and `infra`.

### Services

`services/` owns cohesive workflows. A Service coordinates entities, raw SQL,
gateways, and explicit cross-feature capabilities.

The `services/` directory must not contain `ports/`. Gateway interfaces live with
their implementations under `gateway/<GatewayName>/index.ts`.

Keep linear workflows direct. Split a Service only when responsibilities have
independent lifecycles, not because of an arbitrary line count.

Do not create command buses, one handler per method, generic repositories, base
Services, or interfaces for deterministic internal helpers.

### Gateways

`gateway/` contains meaningful external boundaries such as AI, messaging, storage,
speech, OAuth, spreadsheets, and database execution.

Every gateway is a directory:

```text
gateway/
  AuthGateway/
    index.ts
    GoogleAuthGateway.ts
    TestAuthGateway.ts
```

The interface belongs in `index.ts`. Do not prefix it with `I`. Name concrete
implementations by provider or mechanism plus the capability.

Gateway implementations translate provider protocols and failures. They do not own
business workflow ordering, SQL for another feature, or UI behavior.

### Contracts

`contracts/` is small and optional. Use it for explicit mappers between entities,
DTOs, and transport responses when the mapping deserves a name.

Do not place Zod schemas, DTO declarations, gateway interfaces, or generic helpers
in `contracts/`.

### Utilities

Put loaders, parsers, and pure feature helpers in `utils/` when they are not a
Service, entity, DTO, gateway, or contract mapper. Keep provider-private helpers
inside their gateway directory.

## Shared shape

```text
src/shared/
  config/                 environment DTOs and loading
  entities/dtos/          data no feature owns
  gateway/
    DatabaseGateway/
      index.ts
  errors/                 shared error base types
  utils/                  app-wide pure helpers
  http/                   TanStack route/controller layer
    index.ts
    controllers/
    functions/
    middleware/
    utils/
  client/                 app shell and app-wide browser primitives
```

Do not create `src/shared/server`. Configuration belongs in `shared/config`, and an
app-wide external interface belongs in `shared/gateway`.

## Dependency direction

```text
shared HTTP controller -> typed application graph -> module Service
module Service -> entities + gateway interfaces + explicit published capabilities
gateway implementation -> its index interface + entities/DTOs + provider library
contract mapper -> entities + DTOs
module client -> module DTOs + shared client primitives
bootstrap -> Services + concrete gateway implementations
```

Forbidden directions:

- entities -> Services, gateways, HTTP, client code, provider SDKs, or `infra`;
- Services or gateways -> client implementation;
- Service -> global container/service locator;
- gateway implementation -> Service orchestration;
- production composition -> tests;
- module -> sibling private implementation details.

Keep the module graph acyclic. When two modules need each other, find the real owner,
publish a narrow one-way capability, or coordinate explicitly at the composition
edge.

## Entities and OOP

Use a class when it protects identity, lifecycle, invariants, or meaningful state
transitions. Use a plain object for DTOs, commands, query criteria, projections,
provider payloads, and client state.

Do not create a class because a noun exists. Do not expose mutable aggregate state
that bypasses invariants. Use explicit creation/restoration paths when those trust
boundaries differ.

## Persistence

Keep PostgreSQL and raw SQL feature-local, normally inside the owning Service. The
Service receives `DatabaseGateway`; only `infra` knows the concrete database class.

Do not introduce generic repositories, DAOs, ORM mirrors, or a repository method for
every Service method. A focused aggregate store is allowed only when shared complex
hydration or writes genuinely obscure several workflows.

## HTTP and client ownership

Controllers under `src/shared/http/controllers` parse DTOs, call one Service
workflow, map the result, and choose HTTP status/headers. They do not own business
logic, SQL, or provider calls.

Feature client screens, components, state, and browser services stay under the
owning module's `client/`. Shared client routes and the app store are composition
edges; shared client primitives must remain feature-agnostic.

## Composition

Build one typed graph at the edge:

```text
createApplication(config, overrides?) -> Application
getApplication()                       -> production singleton
createTestApplication(overrides)       -> same graph with deterministic gateways
```

Use constructor injection. Services never resolve their own dependencies.

## Architecture tests

Protect the structure with tests for:

- retired directory names;
- entity dependency direction;
- Services/gateways importing no client code;
- one `index.ts` per gateway directory;
- DTO declarations living under `entities/dtos`;
- `contracts/` containing mappers rather than schemas.

## Placement checklist

- Stateful invariant or transition? `entities/`.
- Any `*DTO`, tool input, request, response, or event? `entities/dtos/`.
- Workflow or raw SQL? `services/`.
- External capability interface and implementation? `gateway/<Name>Gateway/`.
- Entity/DTO boundary mapping? `contracts/`.
- Loader or pure feature helper? `utils/`.
- HTTP parsing and response selection? `shared/http`.
- Feature UI or browser behavior? Module `client/`.
- Concrete wiring? `infra/bootstrap.ts`.

When in doubt, choose the fewest layers that keep ownership obvious.

## Related skills

- `app-service-boundaries` — DTOs, gateways, providers, SQL, transactions, errors,
  realtime delivery, and typed composition.
- `app-coding-styleguide` — TypeScript/JavaScript implementation style.
- `client-state-management` — client state ownership and lifecycle.
- `client-jsx-styleguide` — React UI and accessibility.
- `app-tests` — test levels, placement, fakes, and assertions.
