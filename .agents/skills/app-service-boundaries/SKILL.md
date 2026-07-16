---
name: app-service-boundaries
description: "Authoritative guide to The Chatbot's runtime and side-effect boundaries: Services, DTOs, Zod schemas, gateway interfaces and implementations, client services, AI tools, SQL, transactions, errors, realtime delivery, and typed composition. Use for API or integration work involving AI, messaging, storage, OAuth, speech, spreadsheets, databases, or browser effects."
---

# App Service Boundaries

## Source of truth and precedence

The current DTOs, Services, gateway directories, database gateway, HTTP layer, and
typed composition root are the source of truth.

Precedence:

1. The user's explicit request and scoped `AGENTS.md`.
2. The owning module's implemented vocabulary and behavior.
3. This skill as the default boundary design.

Load `app-architecture` for placement and dependency direction. Load
`app-coding-styleguide` while implementing.

## Boundary map

```text
HTTP/SSE -> Zod DTO -> Service -> entity
                              -> gateway interface
gateway implementation -> provider protocol -> owned DTO/entity vocabulary
bootstrap -> concrete gateways -> constructor-injected Services
```

Every external boundary must answer:

1. Who owns the data?
2. Where is runtime data parsed?
3. Where are failures translated?
4. What is the transaction or partial-failure policy?
5. How does a deterministic test replace the effect?

## DTOs and runtime schemas

Put DTO declarations under an `entities/dtos/` directory. This applies to Service
inputs, gateway inputs, AI tool inputs, HTTP requests/responses, SSE events, and
browser-only DTOs. Every DTO name ends in uppercase `DTO`; put the transport role
before it (`RequestDTO`, `ResponseDTO`, or `EventDTO`). A role suffix never replaces
the `DTO` suffix.

Use Zod when data crosses an owned runtime boundary. Export the schema value and its
inferred type with the same PascalCase name:

```ts
export const CreateTodoRequestDTO = z.object({
  name: z.string().trim().min(1),
});

export type CreateTodoRequestDTO = z.infer<typeof CreateTodoRequestDTO>;
```

The schema value is the runtime parser; the same-named type is the compile-time
contract. Do not add a parallel handwritten interface.

Internal trusted DTOs may be plain types or interfaces when runtime parsing adds no
value. They still use the `DTO` suffix and live under `entities/dtos/`.

Do not:

- cast `response.json()` to the expected type;
- define request, response, event, or tool schemas inline at their use site;
- keep separate server and client shapes for the same owned payload;
- expose provider payload types outside their gateway implementation;
- put DTO schemas in `contracts/`.

Application-facing values use camelCase. HTTP adapters serialize wire responses to
snake_case; client services normalize them back to camelCase before parsing.

## Contracts and mappers

Use `contracts/` only for explicit mapping helpers between entities and boundary
DTOs. A mapper may parse its result through the DTO schema.

Do not put DTO declarations, Zod schemas, gateway interfaces, or miscellaneous
utilities in `contracts/`.

## Controllers

Controllers may:

- read params, search, headers, cookies, body, and auth context;
- parse the owning request DTO;
- call one Service workflow;
- map the result to a response DTO;
- select status codes and headers.

Controllers must not execute SQL, call provider SDKs, duplicate entity validation,
or describe the business workflow.

Keep shared TanStack HTTP code under `src/shared/http`: route definitions at the
root, route adapters in `controllers/`, server functions in `functions/`,
cross-cutting behavior in `middleware/`, and technical helpers in `utils/`.

## Services

Services orchestrate entities, persistence, gateways, and explicit cross-feature
capabilities. Their public API reads as business capabilities, not transport routes.

Use constructor injection. A Service never resolves a global container and never
constructs its own provider client.

Keep known linear calls direct. Use an event only for genuine independent fan-out
with explicit delivery semantics.

The `services/` directory must not contain `ports/`. A meaningful external
substitution boundary is a gateway and belongs under `gateway/`.

## Gateways

Create a gateway for an external effect with meaningful replacement, failure,
protocol, or test value, including:

- AI/model providers;
- messaging and streams;
- object storage;
- speech-to-text;
- OAuth and external authentication;
- spreadsheets;
- database/transaction execution.

Every gateway gets a directory:

```text
gateway/
  SpeechToTextGateway/
    index.ts
    OpenAiSpeechToTextGateway.ts
    TestSpeechToTextGateway.ts
```

The interface lives in `index.ts`. Do not prefix it with `I`. Concrete classes are
named by provider or mechanism plus capability.

The implementation owns provider authentication, SDK setup, provider request and
response types, serialization, normalization, protocol-specific retry, and provider
error translation.

It does not own Service workflow ordering, business retry/idempotency, durable
tool-call persistence, another feature's SQL, or UI behavior.

Keep provider-private mappers and chunkers inside the gateway directory. Put generic
feature loaders or parsers under the module's `utils/`.

## AI tools

Every AI tool input is a named Zod `*ToolDTO` under the owning module's
`entities/dtos/` directory, including empty-object inputs. The tool registry imports
and parses that DTO before behavior runs.

Tool calls and results remain in the canonical message-content entity model; do not
create a parallel DTO family for them.

The AI gateway translates canonical messages, invokes the model, estimates tokens
when needed, and maps provider failures. Services own tool-round iteration,
persistence order, duplicate handling, compaction decisions, and business recovery.

Long-running work must distinguish durable acceptance from completed business work.
Persist a feature-owned operation only when retries, leases, progress, or crash
recovery give it an independent lifecycle.

## Persistence and SQL

Services receive `DatabaseGateway`; the concrete PostgreSQL `Database` stays in
`infra` and is selected by bootstrap.

Keep raw SQL explicit and feature-local. Put public workflows first and private SQL
or hydration details near the bottom of the Service.

Do not introduce generic repositories, DAOs, base CRUD classes, ORM mirrors, or
repository methods that duplicate the Service API.

Create migrations only with:

```bash
bun run migrate:create -- <name>
```

Then edit the generated file. Never invent migration timestamps or filenames.

Convert application `undefined` to SQL `NULL` only at the query boundary. Restore
entities through explicit mapping rather than arbitrary field mutation.

## Transactions and external effects

State the atomicity boundary before implementing a multi-write workflow.

Use a database transaction when several database operations must succeed or fail as
one outcome. Pass the transaction-scoped SQL handle through feature-local methods.

A database transaction cannot make provider calls atomic. For mixed workflows,
choose and test one explicit policy: idempotent external operation, persisted intent,
compensation, documented partial/unknown outcome, or provider-native atomicity.

If an invariant seems to require atomic writes across modules, reconsider ownership
first. A genuine cross-module transaction needs an explicit coordinator and narrow
published capabilities; modules do not mutate sibling tables directly.

## Error translation

```text
provider/driver failure -> gateway or Service translation
entity invariant        -> entity/domain error
Service failure         -> controller/middleware HTTP mapping
HTTP error DTO          -> client service parsing
client error            -> UI presentation
```

Entity errors do not contain HTTP status codes, localized copy, provider response
objects, or database details.

Catch only for translation, recovery, compensation, cleanup, or an explicit fallback
or unknown outcome. Do not swallow errors into values that are also valid success
results.

## Realtime boundaries

Stream owned events with persisted identity, sequence/order, and timestamps. Updates
must identify what they replace. Optimistic client items use stable correlation IDs.

Every reconnectable stream defines resume, duplicate, ordering, and cursor-expiry
behavior. Publish committed state only.

The gateway owns connection mechanics, retry, backoff, cancellation, and low-level
parsing. The feature slice owns connection state and reduction into client state.

## Client services

Client services own browser HTTP, SSE, storage, media, and device mechanics. They
serialize request DTOs, parse response/event DTOs, translate transport failures, and
return stable data.

They do not own React state, notifications, routing, translations, optimistic UI, or
feature workflow decisions.

## Typed composition

Build one typed application graph. Production selects real gateway implementations;
tests use the same builder with deterministic gateway overrides.

Framework entrypoints may call `getApplication()`. Services must not. Production
code must not import test implementations except concrete `Test*Gateway` classes
that are intentionally published for the test composition root.

## Testing boundaries

Use the narrowest proof:

- DTO tests for Zod parsing and real mapper round trips;
- Service tests with deterministic gateway/database fakes;
- gateway integration tests for provider mapping and error translation;
- database integration tests for SQL, migrations, transactions, and hydration;
- reconnect/replay tests for realtime mechanics.

Do not test a fake's invented behavior instead of the production mapper it replaces.

## Checklist

1. Identify the owner of the vocabulary and effect.
2. Put DTO declarations under `entities/dtos/`.
3. Parse runtime data at the first owned boundary.
4. Keep provider types inside the gateway implementation.
5. Keep workflow decisions in Services.
6. Put each gateway interface in `gateway/<Name>/index.ts`.
7. Keep `services/` free of `ports/`.
8. Make SQL, transactions, and partial failure explicit.
9. Translate errors once at the right boundary.
10. Wire production and tests through the same typed graph.

## Related skills

- `app-architecture` — ownership, placement, entities, Services, and dependency
  direction.
- `app-coding-styleguide` — TypeScript implementation style and DTO naming.
- `client-state-management` — client reduction of HTTP/SSE/browser effects.
- `app-tests` — DTO, Service, gateway, and persistence test conventions.
