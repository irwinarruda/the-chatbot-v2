---
name: arquitecture-guide
description: Preserve this project's application architecture and design when planning, creating, editing, reviewing, or refactoring code. Use this skill whenever the user asks where code should live, adds a server/client feature, creates or changes a Service, Resource/Gateway, Entity, controller, SQL persistence method, dependency wiring, or questions layering, DDD-style entities, dependency inversion, DRY, or repositories. This skill should trigger even when the user does not explicitly say "architecture".
---

# Arquitecture Guide

## Purpose

Use this skill to keep code aligned with `the-chatbot-v2`'s architecture. This guide is about application design: layers, responsibilities, dependency direction, folder structure, and where code belongs. Formatting and low-level TypeScript preferences belong in the coding styleguide, not here.

This project follows a pragmatic DDD-like style: entities are not anemic, Services orchestrate use cases, Resources isolate the outside world, and SQL stays close to the Service that owns the use case. The goal is explicit, local, readable code rather than abstract layering for its own sake.

## Architectural shape

Backend flow:

```text
TanStack route/controller -> Service -> shared Entity
                          -> Resource interface -> Resource implementation
                          -> private SQL methods in the owning Service
```

Client flow:

```text
Client route/component -> Zustand store slice -> client service -> API controller -> server Service
```

Dependency flow:

```text
infra/bootstrap.ts -> Container registrations -> constructor-injected dependencies
                                    -> Mediator for cross-service side effects
```

The important rule is dependency direction: controllers depend on Services, Services depend on Entity classes and Resource interfaces, Resource implementations depend on external APIs/SDKs, and entities do not depend on infrastructure.

## Folder structure

Use the folder structure as an architecture map:

```text
infra/
  bootstrap.ts          production dependency registrations and mediator wiring
  container.ts          tiny DI container
  database.ts           database client wrapper
  migrations/           database schema changes
  server-bootstrap.ts   server bootstrap guard for route handlers

src/server/
  tanstack/
    index.ts            virtual route tree
    controllers/        API route handlers
    middleware/         request/function middleware
  services/             application use cases and orchestration
  resources/            external-system gateways and their interfaces
  utils/                server-only helpers

src/shared/
  entities/             domain entities shared across server/client
  types/                shared transport/domain types when an entity is too much

src/client/
  routes/               UI routes
  components/           reusable UI components
  services/             browser API clients
  stores/               Zustand slices and UI-facing async actions
  entities/             client-facing types
  utils/                browser/client helpers

tests/
  orquestrator.ts       test container, fake gateways, schema reset, helpers
```

## Entities

Entities are DDD-like and intentionally non-anemic. They should own domain state, invariants, and state transitions.

Put code in an Entity when it answers:

- Is this a rule about the object being valid?
- Is this a state transition the object should perform on itself?
- Would duplicating this logic outside the entity risk inconsistent domain state?

Examples of entity responsibilities:

- Validating required fields and enum values.
- Normalizing domain fields during construction or mutation.
- Updating timestamps when state changes.
- Exposing JSON/transport shape when the entity is shared across boundaries.

Do not put infrastructure, SQL, HTTP parsing, external API calls, or dependency resolution in entities.

## Services

Services are the application layer. A Service owns a use-case area and coordinates entities, persistence, resources, and events.

Put code in a Service when it answers:

- Is this a business use case or application workflow?
- Does it coordinate multiple entities or resources?
- Does it decide when to persist, emit events, or call an external gateway?
- Does it represent the public API of a backend capability?

Services should expose public methods that read like use cases. Private helpers may exist when they clarify a domain step, but persistence helpers should stay near the bottom of the class.

### SQL in Services, not repositories

This project deliberately does not use repositories.

Why:

- The app is small enough that a repository layer would mostly duplicate Service methods.
- Raw SQL is part of understanding the use case; hiding it behind generic repositories makes the flow harder to inspect.
- Keeping SQL in the owning Service makes reads, writes, and domain orchestration visible in one file.
- There is no ORM model layer to abstract over; adding a repository would be ceremony without a strong boundary benefit.

Place SQL in private methods at the bottom of the Service class. This preserves a clean reading order: public use-case methods first, orchestration helpers next, persistence details last.

Do not create repositories, DAO classes, or generic persistence abstractions unless the user explicitly chooses a major architecture change.

## Resources / Gateways

A Resource is a gateway boundary around something outside the domain/application core. Resources are how the application talks to providers, protocols, SDKs, infrastructure services, and channel adapters.

Put code in a Resource when it answers:

- Is this adapting an external API, SDK, webhook payload, storage provider, LLM, OAuth provider, messaging channel, spreadsheet, speech-to-text service, or stream mechanism?
- Is this provider/protocol-specific rather than business-specific?
- Do tests need a fake implementation of the same boundary?

Resources usually have:

- An interface that Services depend on.
- A real implementation for production.
- A test implementation registered by `tests/orquestrator.ts`.

Resources may parse provider payloads into internal DTOs, validate provider-specific signatures, send provider requests, download/upload external media, or manage provider-specific streams/queues. They should not own business rules, application workflows, or SQL.

## Dependency inversion

Yes, this project uses dependency inversion at the application boundary.

Services should depend on Resource interfaces, not concrete provider implementations. Production implementations are selected in `infra/bootstrap.ts`; test implementations are selected in `tests/orquestrator.ts`.

Use constructor injection. Do not import concrete gateway singletons into Services. Do not make Services instantiate their own external clients. This keeps use cases testable and makes provider swaps local to the bootstrap layer.

The project does not invert every tiny helper. Invert dependencies at meaningful boundaries: external APIs, storage, LLMs, messaging channels, auth providers, speech-to-text, spreadsheets, and other side-effectful infrastructure.

## Controllers and middleware

Controllers are thin HTTP adapters. They parse request data, read route/context values, call a Service, and return an HTTP response.

Put code in a controller only when it is HTTP-specific:

- Reading URL params or search params.
- Reading request JSON/body.
- Reading auth context created by middleware.
- Choosing HTTP status/response shape.

Do not put business workflows in controllers. If controller logic starts describing the use case, move it into a Service.

Middleware is for cross-cutting request/function concerns such as auth, security, preferences, error handling, and bootstrap. Middleware should not become a feature-specific business layer.

## Client architecture

Client code follows the same separation idea:

- Routes/components render UI and call store actions.
- Zustand store slices own UI state and user-facing async actions.
- Client services own browser API calls.
- Client entities/types describe client-facing state.
- Shared entities/types are used only when the concept is genuinely shared.

Avoid scattering `fetch` calls through components. Avoid putting server-domain workflows in the client. The client asks the API for capabilities; the server Service owns the capability.

## Mediator

Use the mediator for cross-service side effects that should not create direct Service-to-Service coupling.

Use it when one use case completion should notify another area of the system, but the initiating Service should not need to know the concrete downstream workflow. Do not use it to hide normal linear logic inside a single use case; keep that in the Service.

## Adding or changing a feature

Use this placement checklist:

- Domain invariant or state transition? Entity.
- Business workflow or use-case orchestration? Service.
- Database access for a use case? Private methods at the bottom of that Service.
- External API/protocol/provider/channel/LLM/storage concern? Resource/Gateway.
- HTTP parsing/response only? Controller.
- Browser API call? Client service.
- UI state and user-facing async action? Zustand store slice.
- Cross-service notification? Mediator event.
- New dependency? Register production wiring in `infra/bootstrap.ts` and test wiring in `tests/orquestrator.ts`.
- Schema change? Migration under `infra/migrations/`.

When in doubt, preserve the dependency direction and keep the use case readable in one vertical slice.
