---
name: app-service-boundaries
description: "Authoritative guide to The Chatbot's runtime and side-effect boundaries: application Services, HTTP/SSE contracts, Zod schemas, client services, provider ports/adapters, AI tools, raw SQL, transactions, errors, typed composition, and production/test wiring. Use for API shape or integration work involving AI, messaging, storage, OAuth, speech, spreadsheets, databases, or browser effects, even when the user does not say boundary or architecture."
---

# App Service Boundaries

## Source of truth and precedence

The owned contracts, application Services, outbound ports, concrete adapters,
database executor, and typed composition root in the current module tree are the
source of truth.

Precedence:

1. The user's explicit request and scoped `AGENTS.md`.
2. The owning module's implemented public contracts and integration behavior.
3. This skill as the default boundary design.

Start by identifying the owned vocabulary, runtime parse point, error translation,
atomicity/partial-failure policy, and deterministic replacement seam.

## Purpose

Make side effects explicit without wrapping the application in ceremony. Owned
runtime data is validated once, provider data is normalized immediately, application
workflows remain provider-neutral, and production/tests share one typed graph.

Load `app-architecture` for module ownership and dependency direction. Load
`app-coding-styleguide` while implementing. This skill owns boundary mechanics.

## Boundary map

```text
HTTP/SSE adapter -> owned contract -> application Service -> domain
                                                     -> outbound port
provider/database/browser adapter -> protocol data -> owned internal vocabulary
bootstrap -> concrete adapters -> constructor-injected application graph
```

Every boundary must answer:

1. Who owns the vocabulary?
2. Where is untrusted/runtime data parsed?
3. Which layer translates failures?
4. What is the transaction or partial-failure policy?
5. How does a deterministic test replace the effect?

## Owned HTTP and SSE contracts

Define one Zod-backed contract per real request, response, or event in the owning
module's `contracts/`.

Use the same schema on both sides:

- controller parses requests and constructs/parses responses;
- the HTTP/SSE adapter serializes response keys to snake_case;
- the client service normalizes response keys to camelCase, then parses them with
  the response schema;
- stream producer emits the event contract;
- stream consumer parses the same event contract.

Keep application contracts, client state, and domain data in camelCase. Application
API responses always cross the wire in snake_case; that casing belongs only to the
server and client transport adapters. Keep provider naming private to the adapter
that owns the provider protocol.

```ts
export const TodoResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  dueDate: z.iso.datetime().optional(),
});

export type TodoResponse = z.infer<typeof TodoResponse>;
```

Do not:

- cast `response.json()` to an expected type;
- maintain a handwritten `Wire*` interface beside a schema;
- return domain entities directly as an accidental public API;
- create separate server and client definitions for the same owned payload;
- expose provider payload types as application contracts.

Use a client view model only when the UI adds state or needs a genuinely different
projection. Reuse alone is not enough reason for another model.

## Controller responsibilities

Controllers may:

- read HTTP params, search, headers, cookies, body, and auth context;
- parse owned request contracts;
- call one application workflow;
- map the result into an owned response contract;
- select status codes and headers.

Use `src/shared/http` as the shared TanStack HTTP module. Keep its route manifest at
the root; place route adapters in `controllers/`, server functions in `functions/`,
cross-cutting request/response behavior in `middleware/`, and response helpers,
error mapping, serialization, HTTP authentication, and content loading in `utils/`.
Keep feature request/response schemas in the owning module's `contracts/`; keep
genuinely shared wire contracts in `src/shared/contracts`. Do not move client HTTP
services into `shared/http` until the client-side module is deliberately unified.

Controllers must not:

- describe the business workflow;
- execute SQL;
- call provider SDKs;
- assemble provider-specific payloads;
- duplicate domain validation;
- return an entity's incidental serialization as the endpoint contract.

Keep response mapping explicit and small. Extract a pure mapper only when multiple
endpoints share a projection or the transformation itself is non-trivial.

## Client services

Client services are the browser boundary for HTTP, SSE, storage, media, and device
APIs. Components and slices call client services rather than these mechanisms
directly.

Client services should:

- serialize request contracts;
- parse response/event contracts;
- own transport headers and mechanics;
- translate transport failures into the small owned client error model;
- own connection/retry mechanics for streams;
- return stable application-facing data.

They should not own React state, notifications, routing, translations, optimistic UI,
or feature workflow decisions.

## Application Services

Application Services orchestrate domain behavior, persistence, and outbound ports.
Their API describes capabilities, not transport endpoints.

Use constructor injection. A Service must never call a global container or instantiate
its own provider client.

Keep direct workflows direct. If a method always calls one known next capability and
awaits it, use a published contract or explicit coordinator instead of an event.

Do not create an interface for every Service. Add an interface when another module
needs a narrow published capability or composition/testing needs a real substitution
boundary. Internal deterministic classes do not need ceremonial twins.

## Outbound ports

Create a port when an external effect has meaningful replacement, failure, protocol,
or test value:

- AI/model invocation;
- messaging channels and streams;
- object storage;
- speech-to-text;
- OAuth/provider authentication;
- spreadsheets or other external systems.
- database and transaction execution.

Place the port with the application code that needs it. Place the concrete adapter
under the owning module's `server/` or `client/` integration area.

Name the port after the capability, not the vendor. Name the implementation after the
vendor plus capability.

The adapter owns:

- provider authentication and SDK setup;
- provider request/response types;
- protocol serialization and normalization;
- provider error translation;
- provider-specific retry only when the protocol requires it.

The adapter does not own:

- application workflow ordering;
- business retries/idempotency;
- durable tool-call/result persistence;
- feature Service calls;
- database writes outside its own infrastructure responsibility;
- UI behavior.

## AI boundary and tools

The AI gateway translates canonical messages, calls the model, estimates provider
tokens when needed, and maps provider failures. The application layer owns:

- tool-round iteration and maximum rounds;
- persistence order for calls and results;
- duplicate call handling and idempotency;
- uncertain outcomes and crash recovery;
- compaction decisions and recent-turn protection.

Tool definitions belong to the feature whose capability they expose. Compose feature
tool sets in bootstrap and inject them into one small generic execution policy.

Do not create one class per tool. Group related definitions until independent
responsibility or size gives a real reason to split.

Tool input is runtime data. Define every input as a named Zod `*ToolDTO` in the
owning module's `application/tools/` folder, including empty-object inputs. The tool
registry imports that DTO and parses input with it before application behavior runs;
do not define input schemas inline or reuse a generic empty-input DTO across
features. This rule applies to tool input only. Tool calls and results use the
canonical message content model rather than parallel DTO families.

For long-running tools, define whether completion means completed business work or
durable acceptance. Asynchronous work returns an explicit accepted outcome with a
stable feature operation ID; never report accepted work as completed business work.

When work must survive time or process failure, persist a feature-owned operation or
intent with status, attempts, next-attempt time, and provider idempotency key. A
worker or explicit application entrypoint claims due work with concurrency
protection and invokes the same application capability. Business retry must not
depend on process memory, the originating request, or an open SSE connection.

## Persistence and raw SQL

Keep SQL explicit and feature-local. Application Services receive the app-wide
database/transaction executor port; the concrete PostgreSQL wrapper stays in
`infra` and is selected by bootstrap. Put public workflows first, orchestration
next, and private SQL/hydration details near the bottom when they remain in the
Service.

Do not introduce:

- generic repositories or DAOs;
- base CRUD classes;
- ORM-shaped entity mirrors;
- repository methods that duplicate the Service API.

A narrow aggregate store is justified when multiple workflows share complex
hydration/writes or persistence mechanics hide the workflows. Model only that shared
need.

Convert application `undefined` to SQL `NULL` only at the query boundary. Translate
database rows through explicit restoration/mapping rather than mutating entity fields
from outside.

## Transactions and external side effects

State the atomicity boundary before implementing a multi-write workflow.

Use a database transaction when several database operations must succeed or fail as
one application outcome. Pass the transaction-scoped database handle through the
feature-local persistence operations rather than hiding nested independent writes.

A database transaction cannot make provider calls atomic. For workflows that mix
database and external effects, choose and test an explicit policy:

- perform an idempotent external operation and persist its key/outcome;
- persist intent, then retry the external operation;
- compensate a completed earlier step;
- surface a documented partial/unknown outcome;
- use a provider-native atomic operation when available.

Never imply atomicity the system does not provide.

If one invariant appears to require atomic writes across modules, reconsider
ownership first: one module should usually own the atomic outcome. When a genuine
cross-module transaction remains, an explicit coordinator owns it and invokes narrow
published transactional capabilities through an opaque transaction context. Modules
never mutate sibling tables directly.

## Error translation

Keep failures stable as they cross boundaries:

```text
provider/driver failure -> adapter/application translation
domain invariant        -> domain error
application failure     -> controller/middleware HTTP mapping
HTTP error contract     -> client service parsing
client error            -> UI presentation decision
```

Domain errors do not contain HTTP status codes, localized UI copy, provider response
objects, or database details.

Catch only for:

- meaningful translation;
- recovery or fallback;
- rollback/compensation;
- cleanup;
- preserving an explicit unknown outcome.

Do not swallow errors into `[]` or `undefined` when those are valid successful
results. Do not catch only to log and rethrow.

## Realtime boundaries

Stream canonical owned events, not fragments that force the client to invent domain
identity.

Message events should carry persisted IDs, sequence/order, timestamps, and exact
message identity. Updates identify the item they replace. Optimistic client items use
a stable correlation ID when server identity is not yet known.

Every reconnectable stream defines a resume policy. Emit stable SSE event IDs and
monotonic sequence values. On reconnect, accept `Last-Event-ID` or an explicit cursor
and either replay persisted events or return an authoritative snapshot before
continuing. Define ordering, cursor expiry, and duplicate handling.

Progress represents committed state only. Publish after commit, or persist an
outbox/event row in the same transaction and publish from it. Never expose an
uncommitted transition through SSE.

The stream adapter owns connection, retry, backoff, cancellation, and low-level
parsing. The feature slice owns connection state and reduction into feature state.
Only an explicit lifecycle exit should permanently stop retries.

## Typed composition

Build one typed graph:

```ts
type Application = {
  identity: IdentityService;
  chat: ChatService;
  todos: TodoService;
};

function createApplication(
  config: Config,
  overrides: Partial<ApplicationDependencies> = {},
): Application {}
```

Production creates real adapters. Tests call the same graph builder with deterministic
overrides. Keep production source free of test imports and environment-based surprise
selection.

If a framework requires global access, expose a typed `getApplication()` only at the
entry boundary. Do not expose arbitrary string-plus-generic resolution.

## Testing boundaries

Add the narrowest tests that prove the contract:

- contract round trips using the actual server mapper and shared schema;
- application workflow tests with deterministic port fakes;
- provider adapter mapping tests using provider fixtures;
- PostgreSQL integration tests for SQL, transactions, migrations, hydration, and
  optimistic concurrency;
- failure-injection tests for partial and unknown outcomes;
- forced disconnect/reconnect tests for streams.

Do not test a fake's invented behavior instead of the production mapper it is meant
to replace.

## Checklist

1. Identify the owner of the vocabulary and effect.
2. Parse runtime data at the first owned boundary.
3. Keep provider types inside the adapter.
4. Keep workflow decisions in the application layer.
5. Use a port only for a meaningful boundary.
6. Make SQL and transaction scope explicit.
7. State the partial-failure policy for external effects.
8. Translate errors once at the correct boundary.
9. Build production/tests from the same typed composition.
10. Prove the boundary with a contract, application, adapter, or integration test.

## Related skills

- `app-architecture` — module ownership, dependency direction, DDD/OOP, and events.
- `app-coding-styleguide` — TypeScript implementation style and contract naming.
- `client-state-management` — client reduction of HTTP/SSE/browser effects.
- `app-tests` — contract, application, persistence, and adapter test conventions.
