---
name: app-architecture
description: "Authoritative guide to The Chatbot's feature-oriented modular-monolith architecture, module ownership, folder placement, DDD/OOP, and dependency direction. Use whenever planning, creating, moving, reviewing, or refactoring server or client features; changing entities, value objects, application Services, controllers, tools, SQL ownership, wiring, or cross-module dependencies; or discussing repositories, events, layering, coupling, DRY, and shared code, even when the user does not say architecture."
---

# App Architecture

## Source of truth and precedence

The implemented architecture under `src/modules`, `src/shared`, and `infra` is the
source of truth. This skill describes the completed target architecture. When prose
and code disagree, verify whether the code is an intentional exception or
architectural drift before copying it.

Precedence:

1. The user's explicit request and the nearest scoped `AGENTS.md`.
2. Implemented module ownership and dependency direction.
3. This skill as the default application architecture.

Use this skill to answer two questions first:

1. Which module owns this concept or workflow?
2. Which direction may the dependency point?

## Purpose

Keep the application small, explicit, and readable from one user-facing capability
to its effects. The architecture is a feature-oriented modular monolith with
pragmatic DDD and selective OOP.

The target is neither functional minimalism nor enterprise DDD. Rich domain objects
earn their place by protecting state. Application Services make workflows visible.
Ports isolate meaningful external effects. Plain data remains plain.

Load `app-service-boundaries` when work touches contracts, providers, SQL,
transactions, errors, or dependency composition. Load `client-state-management`
when work touches Zustand, URL state, SSR hydration, streams, or client workflows.

## First decision: ownership and layer

Before adding a file:

1. Pick the capability that owns the concept or workflow.
2. Pick the responsibility: domain, application, contract, server adapter, client, or
   genuinely shared primitive.
3. Check whether the dependency points inward and keeps the module graph acyclic.
4. Add only the folders and abstractions the responsibility actually needs.

If ownership is unclear, stop there. A polished file in the wrong module is still an
architectural bug.

## Canonical shape

```text
framework route/controller -> module application workflow -> domain model
                                                   -> outbound port -> adapter
                                                   -> feature-local persistence

shared client route -> feature screen/component -> feature slice -> client service
                                            -> owning contract -> HTTP controller
```

Framework entrypoints remain thin. Modules own behavior. Infrastructure selects
concrete implementations but does not leak into domain or application code.

## Top-level ownership

```text
src/
  modules/
    <capability>/
      domain/          aggregates, entities, value objects, domain errors
      application/     cohesive workflows and outbound port contracts
      contracts/       Zod-backed HTTP/SSE request, response, and event contracts
      server/          controllers and concrete server adapters owned by the module
      client/          feature-owned browser implementation
        screens/       page-level workflow composition
        components/    feature-owned React UI
        state/         Zustand slices and pure client reducers
        services/      HTTP, SSE, storage, media, and browser adapters
  shared/
    domain/            tiny domain-agnostic kernel only
    contracts/         transport primitives no capability owns
    http/              shared TanStack HTTP module
      index.ts         virtual route manifest
      controllers/     HTTP route adapters
      functions/       TanStack server functions
      middleware/      cross-cutting request/response behavior
      utils/           shared HTTP support helpers
    client/            React/TanStack application shell and shared client primitives
      routes/          thin TanStack route entrypoints
      stores/          app-wide Zustand composition root
      components/      app-wide UI only
        ui/            generic Base UI and shadcn primitives
        terminal/      shared terminal design system
      providers/       app-wide React providers and hooks
      i18n/            dictionaries and locale lookup
      styles/          global client tokens and Tailwind source
      services/        app-wide browser services
      entities/        plain app-wide browser data
      utils/           generic browser/client helpers
    server/            app-wide technical ports such as database execution
infra/
  bootstrap.ts         typed production composition root
  config.ts            environment and technical configuration
  database.ts          PostgreSQL wrapper
  migrations/          schema history
tests/
  application/         application workflows with deterministic fakes
  contracts/           owned HTTP/SSE schemas and mapping
  domain/              invariants and transitions
  integration/         PostgreSQL, migrations, and concrete adapters
```

Do not create every folder for symmetry. A module gets a folder only after it has
code with that responsibility. Empty architecture is still clutter.

## Feature ownership

Every domain concept has exactly one owning module. Reuse does not make code shared.

- Start module-local.
- Promote only genuinely domain-agnostic or app-wide primitives.
- Let sibling modules consume published contracts from the owner.
- Never copy a domain concept into `shared` because multiple features import it.
- Never reach into another module's private helpers, persistence, slice internals,
  controllers, or provider adapters.
- Keep the module import graph acyclic.

When two modules appear to need each other, do not add a mediator to disguise the
cycle. Find the real owner, expose a narrower one-way contract, or place the
cross-feature workflow in a small explicit coordinator at the composition edge.

## Published module surface

A module may publish only what callers need:

- domain entities or value objects that genuinely cross the boundary;
- application Services or narrow query/capability contracts;
- request, response, and event schemas;
- client feature entrypoints.

Avoid broad barrels that make private code look public or hide dependency direction.
Prefer explicit imports from the published owner.

## Dependency direction

```text
shared client routes -> module client public APIs
shared client store composition -> module feature slices
module client screens/components -> module contracts + shared client primitives
module client screens -> shared client store hook
module server -> module application + module domain
module application -> module domain + outbound ports, including database execution
module adapters -> outbound ports + provider/database libraries
module domain -> nothing outside itself or tiny shared-domain primitives
bootstrap -> concrete modules and adapters
```

Forbidden directions:

- domain -> HTTP, database, provider SDK, React, Zustand, TanStack, or `infra`;
- server -> client implementation;
- module -> sibling internals;
- Service -> global container/service locator;
- provider adapter -> application orchestration or another feature Service;
- production composition -> test code.

## DDD and OOP policy

Use a class when it makes invalid state harder to create or keeps meaningful state
transitions with the state they change.

Use rich entities/aggregates for:

- identity and lifecycle;
- invariants spanning multiple fields;
- state transitions that update timestamps or related state;
- behavior whose duplication would make domain state inconsistent.

Use value objects when validated construction can make an invalid concept
unrepresentable.

Use plain TypeScript objects for:

- HTTP and provider payloads;
- commands and query criteria;
- projections and read models;
- frontend state;
- pure transformation inputs and outputs.

Do not:

- create a class because a noun exists;
- use inheritance when composition is enough;
- expose mutable public aggregate fields that bypass invariants;
- hydrate entities through arbitrary field assignment;
- create a generic agent/tool execution model when canonical messages already
  represent synchronous calls and results. A feature-owned durable operation/intent
  is justified only when retries, progress, leases, compensation, or crash recovery
  give the work an independent lifecycle;
- create DTO variants merely because one query returns fewer fields.

When creation and persistence restoration have different trust boundaries, provide
explicit `create` and `restore` factories.

## Application Services

An application Service owns a cohesive workflow area. Its public methods read as
capabilities. It coordinates domain behavior, persistence, ports, and explicit
cross-feature calls.

Keep normal linear control flow direct. A direct awaited method call is clearer than
an event emitted only to reach the next known step.

Split a Service when its workflows have distinct application lifecycles that change
independently, not because it crossed an arbitrary line count or happens to use an
external adapter. Constructor dependencies are a useful signal: every dependency
should make sense for the same responsibility.

Do not create:

- command/query buses;
- one handler class per method;
- orchestration entities with no domain identity;
- interfaces for deterministic internal helpers;
- private helper methods whose only purpose is shortening the public method.

## Persistence placement

Keep PostgreSQL and raw SQL. SQL is part of understanding the use case and stays
inside the owning module.

The default is feature-local private persistence methods near the workflow. An
application Service receives the app-wide database/transaction executor port and
writes raw SQL without importing the concrete PostgreSQL wrapper from `infra`. Do not
introduce generic repositories, base repositories, DAOs, or ORM-shaped layers.

A narrow aggregate store is justified only when multiple workflows share
non-trivial hydration/write behavior or persistence mechanics obscure application
orchestration. If that threshold is met, model the actual need, such as
`ChatStore`; do not mirror every Service method behind a repository interface.

See `app-service-boundaries` for transactions and external side-effect policy.

## External effects

Invert dependencies only at meaningful boundaries with replacement, failure, or
test value:

- AI/model providers;
- messaging channels and live streams;
- object storage;
- speech-to-text;
- OAuth and external authentication;
- spreadsheet and other external systems.

Adapters translate protocols. They do not own application workflows, business
rules, tool-round persistence, UI decisions, or SQL for another capability.

Process-local stream fan-out is acceptable only for a documented single-instance,
best-effort feature. Multi-instance or replayable progress needs a shared durable
source or broker; persisted feature state remains authoritative.

## Controllers and middleware

Controllers are HTTP adapters. They may:

- parse params, search, headers, body, and auth context;
- validate request contracts;
- invoke one application workflow;
- map results/errors to response contracts and status codes.

Move any description of the business workflow into the application layer.

Middleware is for cross-cutting HTTP concerns such as auth context, security,
preferences, error mapping, and bootstrap. It must not become a feature business
layer. Server request-cookie parsing and response-cookie serialization belong here or
in a controller; browser cookie persistence belongs in the owning client service.

Keep the TanStack server HTTP layer under `src/shared/http`, separated by
responsibility: the route manifest at the root, route adapters in `controllers/`,
server functions in `functions/`, cross-cutting behavior in `middleware/`, and
response, error, serialization, authentication, and content-loading support in
`utils/`. Keep business workflows and provider behavior with their owning feature
modules; HTTP files remain thin framework adapters.

## Client ownership

Keep backend DDD out of React state. Browser models are plain data.

- Thin route entrypoints under `src/shared/client/routes` compose published module
  screens.
- Screens coordinate route state and feature actions.
- Components render and emit user intent.
- Zustand slices own shared client workflow state.
- Client services own browser HTTP/SSE/storage boundaries.
- `src/shared/client/stores` composes module slices into the app hook; feature slice
  definitions must not import that composition root or its app-wide state type.
- Shared client primitives contain only app-wide UI, providers, browser services,
  and generic hooks. They must not import feature modules.

`src/shared/client` has two intentional dependency roles. `routes/` and `stores/`
are outer composition edges and may import published module client APIs or slices.
Its primitive folders are inward dependencies consumed by modules and must stay
module-agnostic. Do not flatten these roles into one undifferentiated shared folder.

Load `client-state-management` for state placement and lifecycle rules.

## Related skills

- `app-service-boundaries` — contracts, ports/adapters, SQL, transactions, errors,
  AI tools, realtime delivery, and typed composition.
- `app-coding-styleguide` — non-visual TypeScript/JavaScript implementation style.
- `client-state-management` — URL/Zustand/local state, SSR, optimistic updates, and
  realtime reduction.
- `client-jsx-styleguide` — React UI implementation and the terminal design system.
- `app-tests` — test placement, levels, harnesses, fakes, and assertions.

## Cross-feature coordination and events

Prefer a direct call or explicit application coordinator when the follow-up is known
and part of the same workflow.

Use an event only when:

- consumers are independent and may multiply;
- the producer should not know which follow-ups exist;
- delivery, ordering, and failure behavior are explicit;
- one typed event map ties each name to its payload.

An in-memory `Promise.all` dispatcher is synchronous coordination, not durable
messaging or a transaction boundary. Name and use it honestly.

## Composition root

Use constructor injection in application code. Build one typed application graph at
the edge:

```text
createApplication(config, overrides?) -> Application
getApplication()                       -> production singleton
createTestApplication(overrides)       -> same graph with deterministic fakes
```

Controllers may access the application graph at the framework boundary. Services
must not resolve their own dependencies. Production code must never import fakes or
test infrastructure.

## Architecture testing

Test the boundaries that make the architecture real:

- domain tests for invariants and transitions;
- application tests with deterministic ports;
- contract tests for shared schemas and mapping;
- integration tests for PostgreSQL, migrations, and concrete adapters;
- import/architecture tests for forbidden directions and cycles.

Do not mistake route implementation tests for contract tests. Test owned behavior at
the narrowest reliable seam.

## Placement checklist

- Domain invariant or transition? Owning module `domain/`.
- Application workflow? Owning module `application/`.
- HTTP/SSE request, response, or event? Owning module `contracts/`.
- Provider or browser integration? Owning module adapter under `server/` or `client/`.
- SQL? Owning module, near its workflow; narrow aggregate store only if justified.
- HTTP parsing/response mapping? Controller.
- Shared client workflow state? Feature slice.
- TanStack client route or app-wide store composition? `src/shared/client`.
- Feature screen or component? Owning module `client/`.
- Navigable state? URL, not a duplicate slice field.
- Pure difficult transformation? One named module-local function with focused tests.
- Cross-feature linear step? Direct published contract or explicit coordinator.
- Independent fan-out? Typed event with stated semantics.
- New dependency? Typed application composition root and deterministic test override.
- Truly domain-agnostic primitive? `shared`; otherwise keep the owner.

When in doubt, choose the smallest structure that preserves ownership, dependency
direction, and an end-to-end readable workflow.
