# Plan 009: Architecture Realignment

## Executive decision

Keep DDD. Keep selective OOP. Change the boundaries.

The backend is not difficult because it uses classes or domain entities. Its best
code is the behavior-rich `Chat`, `Message`, and `Todo` model. The complexity comes
from horizontal ownership, duplicated representations, hidden control flow, and
several half-completed migrations accumulating inside broad Services.

The target is a small feature-oriented modular monolith:

```text
route/controller -> application workflow -> domain model
                                      -> meaningful outbound port -> adapter
                                      -> feature-local persistence
```

The important words are **feature-oriented** and **meaningful**. This plan does not
introduce enterprise DDD, a command bus, handler-per-method classes, a generic
repository layer, or interfaces for deterministic internal code. It gives every
capability one owner, makes dependencies visible, and removes duplicate truths.

## Why the current architecture feels wrong

The project has 18,792 TypeScript/JavaScript lines across 208 files. That is not a
large system, but its complexity is concentrated:

| Hotspot | Lines | Complexity | What it owns |
|---|---:|---:|---|
| `MessagingService.ts` | 1,073 | 154 | intake, auth gating, persistence, delivery, audio, agent execution, tools, compaction, SSE, legacy migration |
| `AiToolService.ts` | 571 | 30 | every tool, three feature Services, classification, execution policy |
| `AuthService.ts` | 533 | 63 | OAuth, tokens, users, credentials, SQL, chat side effects |
| `Message.ts` | 334 | 81 | a legitimate rich model, but also HTTP-shaped failures and serialization |
| chat route | 532 | 37 | session, scrolling, composer layout, recording, stream lifecycle, rendering |
| chat slice | 305 | 24 | auth, messages, SSE, optimistic updates, devices, recording, upload, logout |

The raw size is only a signal. The architectural failures are more precise:

1. The browser/server contract is already broken at runtime while typecheck passes.
   Controllers emit camelCase entity JSON, while browser services parse snake_case.
2. `MessagingService` has ten dependencies and contains several independent
   lifecycles plus roughly a full persistence adapter.
3. `MessagingService -> Mediator -> MessagingService` hides a normal direct call.
4. `AuthService -> Mediator -> MessagingService` creates a hidden capability cycle.
5. Production and test dependency graphs are manually duplicated and have drifted.
6. The AI provider adapter controls application tool callbacks and persistence
   timing instead of only adapting a provider.
7. The tool registry is a second growing cross-feature hub.
8. Canonical messages are still dual-read and dual-written with legacy columns.
9. Domain entities import HTTP/infrastructure exceptions.
10. Server code imports client preference code, and SSR mutates a process-global
    Zustand store while rendering.
11. Several database multi-write workflows do not have explicit transaction
    boundaries.
12. SSE messages are fragments rather than persisted canonical messages; the client
    invents IDs and reconciles audio updates by guessing.

## Evidence from the current implementation

### What is worth preserving

- `Chat` is a real aggregate root. It owns visibility, turn grouping, tool pairing,
  compaction cursor rules, and conversation transitions.
- `MessageContent` is one small canonical union. Tool calls/results do not need a
  parallel agent-run hierarchy.
- `Todo` owns meaningful state transitions.
- Controllers are generally thin.
- External providers already have useful gateway interfaces and test doubles.
- Raw SQL is explicit and readable in smaller Services such as `TodoService`.
- Message deduplication is database-backed.
- Summary writes use optimistic concurrency.
- The client already follows route -> slice -> client service -> controller for its
  main workflows.
- The virtual TanStack route manifest, generated route tree, terminal UI system,
  Bun, strict TypeScript, Biome, PostgreSQL, and Zustand are all sound choices.

### Concrete drift to remove

- `src/server/services/MessagingService.ts` owns the entire chat application and
  backward-compatibility persistence.
- `infra/bootstrap.ts` registers the same `MessagingService` as both the sender and
  receiver of `RespondToMessage`.
- `infra/bootstrap.ts` and `tests/orquestrator.ts` construct separate graphs; the
  test graph omits a production mediator handler and may select a real spreadsheet
  adapter based on environment state.
- `IAiChatGateway.runAgent` accepts application callbacks. `PiAiChatGateway` thereby
  owns tool-round workflow semantics.
- `src/shared/entities/*` imports `infra/exceptions.ts`, reversing the desired
  dependency direction.
- `1783869085761_drop-legacy-message-columns.js` does not drop the old message
  columns, and `MessagingService` still reads and writes both models.
- `web-messages`, `web-todos`, `web-todo`, and `web-auth-me` return entity JSON,
  while `webChatService` and `todoService` assert incompatible wire shapes.
- chat SSE events have no canonical message identity; the client creates temporary
  IDs and scans backward to guess which audio message changed.
- todo filters live in both the URL and Zustand, and mutations are followed by
  redundant refreshes despite already updating store state.

### Audit evidence index

| Finding | Current evidence |
|---|---|
| Browser/server contract mismatch | `src/shared/entities/Message.ts:318`, `Todo.ts:99`, `User.ts:87`; `src/client/services/webChatService.ts:6`, `todoService.ts:18` |
| Chat god service | `src/server/services/MessagingService.ts:57` and its ten constructor dependencies |
| Self-directed mediator | `MessagingService.ts:183`; `infra/bootstrap.ts:174`; synchronous handlers in `infra/mediator.ts:14` |
| Duplicated composition | `infra/bootstrap.ts:26`; `tests/orquestrator.ts:75`; missing production-equivalent handler after `tests/orquestrator.ts:253` |
| Provider owns application callbacks | `src/server/resources/IAiChatGateway.ts:22`; `PiAiChatGateway.ts:68,112,256` |
| Central tool coupling | `src/server/services/AiToolService.ts:46,257` |
| Legacy dual representation | `MessagingService.ts:741,766,815,890,974`; `infra/migrations/1783869085761_drop-legacy-message-columns.js:1` |
| Domain depends on HTTP infra | `src/shared/entities/Chat.ts:2`, `Message.ts:2`, `Todo.ts:2`, `User.ts:2`; `infra/exceptions.ts:8` |
| Missing database transaction boundaries | `src/server/services/AuthService.ts:242,331`; `MessagingService.ts:123`; contrast `TodoService.ts:58` |
| Non-canonical realtime state | `src/client/stores/slices/chatSlice.ts:109,141`; `MessagingService.ts:224` |
| Reconnect lifecycle conflict | `src/client/services/webChatStreamService.ts:33`; `src/client/stores/slices/chatSlice.ts:103` |
| Duplicate todo state/work | `src/client/routes/todo.tsx:27,98,139`; `src/client/stores/slices/todoSlice.ts:18,122,162` |
| Server imports client behavior | `src/server/tanstack/middleware/prefs.ts:2`; `src/server/tanstack/functions/load-privacy.ts:2`; `src/client/utils/CookieParser.ts:27` |
| Process-global SSR state | `src/client/stores/index.ts:11`; `src/client/routes/__root.tsx:46`; `src/client/stores/slices/prefsSlice.ts:20` |

## Architectural principles

Apply these rules in domain-neutral form:

1. Start module-local. Promote only truly domain-agnostic or app-wide primitives.
2. Reuse does not imply shared ownership. Every domain concept has one owner.
3. The feature import graph must be a DAG. Cycles indicate misplaced ownership or
   an orchestration workflow that needs to be made explicit.
4. Siblings consume published contracts, not internal helpers, persistence, UI, or
   store implementation.
5. Keep one vertical workflow readable from adapter to outcome.
6. Put external effects behind boundaries that have actual replacement, failure, or
   test value.
7. Normalize provider/wire data immediately at the boundary.
8. Persist source facts and derive views/capabilities. Do not keep two mutable truths.
9. Put durable navigational UI state in the URL; let client state rehydrate from it.
10. Give difficult transformations one pure, named, tested seam.
11. Translate errors at boundaries and catch only for recovery, rollback, cleanup,
    or meaningful translation.
12. Prefer locality. Extract by responsibility or reuse, not to make a file look
    architecturally impressive.

Avoid these patterns:

- a single global frontend store as a backend model;
- service-locator calls inside backend behavior;
- mandatory interface/API/mock triplets for every capability;
- passive data interfaces called entities;
- one broad Service or slice that becomes a feature dumping ground;
- production composition importing test infrastructure;
- all business policy in one global config directory;
- an absolute ban on a short comment that explains a protocol/security constraint.

## Target architectural model

### 1. Feature ownership first

Organize code by capability, while preserving TanStack entrypoints that must remain
framework-owned:

```text
src/
  modules/
    identity/
      domain/
      application/
      contracts/
      server/
      client/
    chat/
      domain/
      application/
      contracts/
      server/
      client/
    todos/
      domain/
      application/
      contracts/
      server/
      client/
    cash-flow/
      domain/
      application/
      contracts/
      server/
    system/
      application/
      server/
  shared/
    contracts/       domain-agnostic transport primitives only
    domain/          tiny error/value kernel only if genuinely shared
    client/          app-wide UI primitives/providers only
  client/routes/     thin TanStack route entrypoints
  server/tanstack/   route manifest and cross-cutting HTTP middleware
infra/
  bootstrap.ts
  config.ts
  database.ts
  migrations/
```

This is a direction, not a demand to create every folder immediately. A module only
gets a folder when it has code of that responsibility. `system` does not need a
domain layer just to match the others.

### 2. Published module contracts

A module may expose only what another module or framework entrypoint needs:

- domain entities/value objects that genuinely cross the capability boundary;
- application service interfaces or narrow query capabilities;
- request/response/event schemas;
- client feature entrypoints.

It must not expose private SQL helpers, provider mapping, internal tool builders,
slice internals, or controller helpers.

Expected dependency direction:

```text
TanStack entrypoints -> module public APIs
module client -> module contracts + shared client primitives
module server -> module application + module domain
module application -> module domain + outbound ports
module adapters -> outbound ports + provider/database libraries
module domain -> nothing outside domain/shared-domain primitives
bootstrap -> every concrete module/adapter
```

Cross-feature workflows should use a small explicit coordinator at the composition
edge or a one-way published application contract. Do not solve source-code cycles
with a string event bus.

### 3. DDD and OOP policy

Use classes when they make invalid state harder to create or keep transitions close
to the state they change.

Keep classes for:

- aggregates and entities with identity/lifecycle (`Chat`, `Message`, `Todo`, likely
  `User` after its invariants are clarified);
- value objects whose construction validates/normalizes a concept;
- stateful adapters and application Services with injected dependencies.

Use plain TypeScript objects for:

- HTTP/provider payloads;
- commands and query criteria;
- endpoint projections/read models;
- frontend state;
- pure function inputs/outputs.

Do not use inheritance. Do not create a class because a noun exists. Do not create a
DTO for every method. Do not expose mutable public fields that allow restoration or
callers to bypass invariants. Add explicit `create`/`restore` factories where the two
construction paths differ.

### 4. Application Services

A Service owns a cohesive application capability, not a database table and not an
entire product area by default.

Public methods should read as workflows. Direct linear control flow stays direct.
Private helpers stay inline unless their name expresses a real concept or they are
reused.

Split `MessagingService` by lifecycle, not line count:

- chat/message intake and delivery;
- assistant/model turn orchestration and compaction;
- channel-specific provider adaptation;
- persistence compatibility, which should disappear after migration.

The exact end state should be decided after legacy deletion. A likely shape is a
cohesive `ChatService` plus an `AssistantService`; it is not one class per use case.

### 5. Persistence policy

Keep PostgreSQL and raw SQL.

Default rule: SQL stays feature-local and close to the workflow. Do not introduce
generic repositories, base repositories, a unit-of-work framework, or ORM-shaped
abstractions.

A narrow aggregate persistence collaborator is justified only when, after legacy
cleanup, at least two workflows need the same non-trivial hydration/write logic or
persistence mechanics still obscure application orchestration. `Chat` may meet this
threshold; `TodoService` currently does not. If introduced, name the concrete
responsibility (`ChatStore` or `PostgresChatStore`) and do not mirror every Service
method.

Database-only multi-write workflows must have an explicit transaction boundary.
Workflows involving external systems need an explicit failure/idempotency policy;
pretending a database transaction makes an external spreadsheet write atomic is
worse than admitting partial failure.

### 6. Provider ports and adapters

Keep interfaces only around meaningful external boundaries:

- AI/model provider;
- messaging channels and streams;
- object storage;
- speech-to-text;
- OAuth/provider authentication;
- spreadsheet provider.

The AI gateway should translate canonical messages, invoke the model, estimate
tokens, and map provider errors. The application layer should own the tool loop,
durable call/result ordering, maximum rounds, retries, compaction, and idempotency.

### 7. Tool ownership

Keep one small generic tool executor/registry, but let each feature own its tools:

```text
chat application
  -> generic tool execution policy
  -> injected tool definitions

todos module      -> todo tool definitions
cash-flow module  -> cash-flow tool definitions
identity module   -> account tool definitions
bootstrap         -> composes all definitions
```

Group related tools in one feature-owned file until that file has a genuine second
responsibility. Do not create one class per tool. The central registry must not
import every concrete feature Service.

### 8. Events and coordination

Delete the `RespondToMessage` mediator path and call the next application step
directly.

Prefer an explicit coordinator for workflows that intentionally span identity and
chat. Retain events only when:

- there may be multiple independent consumers;
- the producer must not know which follow-up capabilities exist;
- failure/delivery semantics are stated;
- the event name and payload are tied by one typed event map.

The current synchronous `Promise.all` mediator is neither asynchronous messaging nor
a transaction boundary. Do not let its name imply guarantees it does not provide.

### 9. Composition and dependency injection

Replace arbitrary string resolution with one typed application graph.

Preferred shape:

```text
createApplication(config, overrides?) -> Application
getApplication()                       -> production singleton
createTestApplication(overrides)       -> same graph with deterministic fakes
```

Constructors remain the injection mechanism. Controllers may obtain the typed
application at the framework boundary; Services must not resolve their own
dependencies. Production and tests share the graph builder, while production source
does not import test code.

### 10. Contracts are first-class boundaries

Create one Zod-backed schema/type per real HTTP or SSE contract and use it on both
sides. Use camelCase because it already matches application/entity serialization.

Rules:

- controllers map domain/application results to response contracts;
- client services parse the exact same schema;
- provider payload types remain private to adapters;
- browser state stays plain data;
- a UI view model exists only when the UI genuinely adds state or derives a different
  representation;
- `response.json() as SomeType` is forbidden at owned API boundaries;
- streamed chat events carry persisted message IDs, sequences, timestamps, and exact
  update identity.

This removes the current `Entity` + `toJSON` + `Wire*` + client entity quadrupling.

### 11. Frontend state policy

Keep React and Zustand. Do not copy backend OOP into React state.

Classify state in this order:

1. durable navigation/flow identity -> URL;
2. shared feature source state and async workflow -> Zustand slice;
3. derivable state -> selector/computation;
4. value consumed once -> return value, not state;
5. transient component interaction -> local React state/ref.

Use one composed app store only if it is created per app/request and slices stay
feature-owned. Never mutate a process-global store during SSR render.

For chat, split only the genuinely separate lifecycles:

- session/messages/stream reduction;
- audio device and recording lifecycle;
- local route layout mechanics such as virtual scrolling/composer measurement.

For todos, the URL owns filters. Choose either authoritative mutation responses or a
refresh policy; do not update locally and then refetch by habit.

### 12. Error ownership

Introduce domain/application errors outside `infra`.

```text
provider error -> adapter maps to stable application failure
domain invariant -> domain error
application failure -> controller/middleware maps to HTTP contract
client service -> parses typed API error
UI -> decides presentation
```

Catch only for recovery, rollback, cleanup, explicit fallback, or meaningful
translation. Empty arrays and `undefined` must not silently mean network failure,
unauthorized access, and valid empty data at once.

## Migration strategy

This migration is ordered to restore truth before moving files. Each phase must be
mergeable and leave the application working.

### Phase 0: Protect the current behavior

Goal: stop architectural work from preserving already-broken assumptions.

1. Add shared schemas for current user, todo, channel-visible message, API error,
   and web chat event.
2. Add contract tests that pass actual `User.toJSON()`, `Todo.toJSON()`, and
   `Message.toJSON()` output through the client-consumed schemas.
3. Add a failing-then-fixed integration seam for each controller/client pair without
   adding route tests to the default suite.
4. Capture current chat/tool/compaction behavior with application tests before moving
   orchestration.
5. Record transaction expectations for user creation, identity linking, message
   intake, and external transfer behavior.

Exit criteria:

- server output and client parsing use the same schemas;
- camelCase is the only owned wire convention;
- typecheck cannot pass while the owned contract is incompatible;
- `bun run typecheck`, `bun run check`, and focused tests pass.

### Phase 1: Finish the canonical conversation migration

Goal: remove compatibility weight before judging Service boundaries.

1. Verify every production row has canonical message content, role, audience, turn,
   and sequence.
2. Verify every chat summary has the canonical JSONB representation/cursor.
3. Stop legacy reads and dual writes.
4. Add and run the real destructive migration that drops old message/summary columns.
5. Delete legacy hydration, projection, and dual-write helpers.
6. Re-run conversation/tool/compaction tests and inspect the new Service shape.

Exit criteria:

- one database representation exists for each message and summary;
- no legacy compatibility branches remain in application code;
- rollback/data backup procedure is documented before destructive production work.

### Phase 2: Establish module ownership without rewriting behavior

Goal: make ownership visible while keeping history reviewable.

1. Create feature module entrypoints for identity, chat, todos, cash-flow, and system.
2. Move rich domain concepts to their owners.
3. Move endpoint/SSE contracts beside their owning modules.
4. Keep TanStack route files thin and framework-located.
5. Move preferences parsing to a pure shared contract; keep browser writes client-side
   and server cookie reads server-side.
6. Enforce import boundaries with Biome/TypeScript rules or a small architecture test.

Exit criteria:

- `src/shared` contains no feature-owned dumping ground;
- no server module imports from `src/client`;
- the feature graph is documented and acyclic;
- moves do not introduce behavior changes.

### Phase 3: Repair domain boundaries

Goal: make DDD real where it is already intended.

1. Move domain failures out of `infra/exceptions.ts`.
2. Map domain/application errors to HTTP in middleware/controllers.
3. Add explicit restore factories for persisted aggregates.
4. Reduce public mutation; keep transitions inside entities.
5. Decide which passive classes should become plain types/value objects rather than
   pretending every database row is a rich entity.
6. Keep `Chat`/`Message` canonical and resist parallel execution entities.

Exit criteria:

- domain code imports no HTTP, database, provider, or client code;
- invalid construction/restoration paths are explicit;
- plain read models are not mislabeled as domain entities.

### Phase 4: Replace hidden plumbing with explicit composition

Goal: one production/test graph and visible control flow.

1. Introduce the typed application factory.
2. Build deterministic production and test variants through overrides.
3. Remove duplicated service registration from `tests/orquestrator.ts`.
4. Ensure tests can never select a real external provider accidentally.
5. Delete the self-directed `RespondToMessage` event.
6. Replace remaining string events with direct coordination; retain a typed event map
   only for events that meet the event criteria.
7. Remove the string-key container if no framework need remains; otherwise restrict it
   to the composition edge behind typed access.

Exit criteria:

- production and tests share one graph definition;
- Service dependencies are visible in constructors;
- no arbitrary generic/string pair can lie about a resolved type;
- no mediator path hides a normal same-workflow method call.

### Phase 5: Move assistant orchestration out of provider adapters

Goal: provider replacement does not change application semantics.

1. Narrow `IAiChatGateway` to provider operations and canonical mapping.
2. Move tool-round iteration, persistence ordering, idempotency, maximum rounds, and
   recovery to the chat application layer.
3. Keep token estimation/provider limitations behind the gateway where provider-
   specific, but keep budget/compaction decisions in application/domain code.
4. Add provider-contract tests for canonical message translation.
5. Add application tests for malformed tool arguments, duplicate call IDs, uncertain
   outcomes, crash recovery, max rounds, and compaction.

Exit criteria:

- the provider adapter cannot call feature Services;
- switching the AI provider does not reimplement the durable workflow;
- application tests can drive tool rounds without a provider SDK.

### Phase 6: Split tool ownership by feature

Goal: adding a todo tool does not edit a central cross-feature god service.

1. Extract generic execution/error policy from the registry.
2. Move related definitions/executors to feature-owned tool modules.
3. Compose tool sets in bootstrap.
4. Remove direct central imports of concrete identity/todo/cash-flow Services.
5. Keep tool input schemas at the boundary and return canonical tool results.

Exit criteria:

- each feature owns its tool vocabulary;
- generic execution code has no business-specific tool list;
- no one-class-per-tool framework appears.

### Phase 7: Split chat by real lifecycle

Goal: make the core workflow readable after compatibility and provider concerns are
gone.

1. Re-measure `MessagingService` after phases 1, 4, and 5.
2. Separate assistant/model orchestration from channel intake/delivery if both remain
   independent responsibilities.
3. Extract a `ChatStore` only if shared hydration/persistence now demonstrably blocks
   both workflows; otherwise keep SQL local.
4. Put database-only multi-write operations in transactions.
5. Define idempotency/partial-failure behavior for audio upload/transcription,
   outbound channel delivery, and external cash-flow writes.
6. Keep direct linear workflows direct.

Exit criteria:

- no chat class owns unrelated provider, persistence-compatibility, and UI-stream
  lifecycles;
- constructor dependencies describe one coherent responsibility;
- a reader can follow intake and response paths without a mediator or SDK callback.

### Phase 8: Repair realtime and frontend ownership

Goal: make the UI consume canonical state instead of reconstructing it.

1. Stream message-created/message-updated contracts with persisted identity.
2. Reconcile optimistic messages by stable client/server correlation.
3. Update audio by exact message ID.
4. Give reconnect/backoff ownership entirely to the stream adapter; the slice receives
   state events and explicitly stops only on lifecycle exit.
5. Create Zustand per application/request or keep SSR preferences outside Zustand
   until browser hydration.
6. Split chat session/stream and recording/device state.
7. Make todo URL filters canonical and remove the slice copy.
8. Remove redundant client entities and `Wire*` shapes where contracts already fit.

Exit criteria:

- reconnect works under a forced disconnect;
- multiple/retried audio messages update deterministically;
- SSR has no process-global user preference mutation;
- each navigable filter/selection has one source of truth.

### Phase 9: Port and enforce the project rules

Goal: make the architecture durable for future agents and contributors.

Do this after the target shape is validated, so the skills describe proven code rather
than freezing a speculative folder diagram.

1. Create `.agents/skills/app-architecture/SKILL.md` with feature ownership, DAG
   dependencies, shared-kernel rules, selective DDD/OOP, direct workflows, persistence
   thresholds, and the final module map.
2. Create `.agents/skills/app-coding-styleguide/SKILL.md` with the domain-neutral
   locality/error rules; avoid duplicating rules it already contains.
3. Add `app-service-boundaries` for contracts, ports/adapters, provider mapping,
   composition, error translation, and production/test wiring.
4. Add `client-state-management` for URL/source/derived/transient state, selectors,
   resets, SSR-safe store creation, and async ownership.
5. Maintain `client-jsx-styleguide` as the concise UI implementation entrypoint and
   keep exact terminal tokens/patterns in progressive references.
6. Add `app-tests` as the authoritative testing guide instead of duplicating full
   test conventions across architecture and coding skills.
7. Port dedicated form/table/chart skills only when this project actually gains
   enough repeated responsibility; do not add unused skills as architectural décor.
8. Give each skill a precise trigger, canonical rule, examples, exceptions, and a
   checklist. Keep examples limited to this project's generic or real public concepts.
9. Add AGENTS guidance requiring the relevant project skill for architecture/code/UI
   work.

Exit criteria:

- skills contain no unrelated domain vocabulary;
- examples use this project's generic or real public concepts;
- rules match implemented architecture and can be checked mechanically where useful.

## Testing architecture

Use four deliberate test levels:

1. **Domain tests**: fast, no DI, no database. Invariants and transitions.
2. **Application tests**: workflows with deterministic ports/fakes. No provider SDK.
3. **Persistence integration tests**: real PostgreSQL, migrations, raw SQL,
   transactions, hydration, optimistic concurrency.
4. **Contract/adapter tests**: shared HTTP/SSE schemas and provider canonical mapping.

Do not turn the default suite into route implementation tests. Do change the current
rule that only Services/Entities/Utils may ever be tested if it prevents a small,
high-value contract or persistence suite. Separate commands are clearer than a ban:

```text
bun run test:unit
bun run test:integration
bun run test:contracts
bun run test
```

Use one test application factory. Database resets should be owned by the integration
suite only. Application tests should not start PostgreSQL merely because a concrete
Service happens to contain SQL today.

## File impact guide

This is an architectural migration, so exact move lists belong in phase-specific
plans after each preceding phase changes the evidence. The expected impact is:

| Area | Action |
|---|---|
| `src/shared/entities` | Move feature-owned domain models; retain only a tiny kernel |
| `src/server/services` | Move into module application/server ownership; split only real lifecycles |
| `src/server/resources` | Move provider ports/adapters to owners; narrow AI gateway |
| `src/server/tanstack` | Keep route manifest/middleware; make controllers module entry adapters or thin delegates |
| `src/client/services` | Move to feature client boundaries; parse shared schemas |
| `src/client/stores` | Keep composed entrypoint, move slices to features, make SSR-safe |
| `src/client/routes` | Keep TanStack route entrypoints thin |
| `src/client/entities` | Delete redundant copies; retain genuine UI view models only |
| `infra/bootstrap.ts` | Replace with typed application composition |
| `infra/container.ts` | Delete or confine behind typed edge access |
| `infra/mediator.ts` | Delete unless genuine typed multi-consumer events remain |
| `tests/orquestrator.ts` | Replace duplicated graph with shared test application factory |
| `infra/migrations` | Complete canonical cleanup with verified destructive migrations |
| `.agents/skills` | Port domain-neutral reference rules after architecture stabilizes |

## Guardrails against overengineering

- No command/query bus.
- No handler class per public method.
- No generic repository/base repository.
- No event sourcing.
- No aggregate/entity for tool execution history beyond canonical messages.
- No interface for pure deterministic helpers.
- No DTO family that repeats the same shape at every layer.
- No module barrel that hides dependency direction.
- No file splitting based only on line count.
- No `shared` promotion based only on reuse.
- No event where a direct awaited call states the workflow better.
- No new framework until a concrete production problem defeats the simple design.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Large folder move obscures behavior changes | Separate moves from behavior patches; phase the migration by capability |
| Contract repair changes live payloads | Version or deploy server/client atomically; validate schemas on both sides |
| Dropping legacy columns loses data | Backfill verification, backup, production audit query, reversible deployment order |
| Tool-loop move changes provider behavior | Characterization tests before extraction; provider mapping contract tests |
| Removing mediator exposes a real cross-feature need | Use an explicit coordinator first; add typed events only with stated semantics |
| Rich entities become serialization models again | Keep response schemas/projections separate from domain serialization |
| Module folders create more navigation | Add only used folders; keep public entrypoints and vertical workflows obvious |
| Repository pressure returns as Services split | Apply the demonstrated-reuse threshold; allow a narrow aggregate store, never a generic layer |
| Frontend global store leaks across SSR requests | Per-request/app store factory and explicit hydration tests |
| Agent rules freeze the wrong design | Port skills after phases prove the target shape |

## Validation for every phase

Run at minimum:

```bash
bun run typecheck
bun run check
bun run test
bun run build
```

Add phase-specific verification:

- contract round-trip tests for all owned HTTP/SSE payloads;
- architecture/import tests for forbidden directions and cycles;
- migration audit queries before destructive changes;
- failure injection for transactions and external partial failures;
- provider-independent assistant workflow tests;
- forced SSE disconnect/reconnect tests;
- SSR tests with two requests carrying different preferences;
- manual web chat, WhatsApp, login, todo, audio, and cash-flow smoke flows.

Current audit baseline is green for `bun run typecheck` and `bun run check` (224
files). The full test suite was not run during this read-only audit because it starts
PostgreSQL and resets the schema.

## Definition of done

The realignment is complete when:

1. Every capability has one visible owner and the module graph is acyclic.
2. Domain code depends on no HTTP, database, provider, client, or framework code.
3. Browser and server share runtime-validated owned contracts.
4. Canonical messages are the only persisted and streamed conversation truth.
5. Provider adapters cannot orchestrate application tools or persistence.
6. Production and tests use one typed application graph.
7. Direct workflows contain no decorative mediator indirection.
8. SQL remains explicit, transaction boundaries are deliberate, and no generic
   persistence framework exists.
9. Frontend URL/store/local state ownership is unambiguous and SSR-safe.
10. DDD/OOP is used where behavior earns it; plain data remains plain.
11. Project skills encode the proven architecture without leaking unrelated domain
    details.
12. A new contributor can follow one feature from route to domain to side effect
    without opening a god service, guessing a wire shape, or tracing string keys.

## Recommended first implementation slice

Do not begin with the folder migration. Begin with Phase 0:

1. canonical camelCase Zod contracts for current user, todo, message, error, and SSE;
2. contract tests using actual server serialization;
3. controller/client adoption;
4. canonical persisted SSE message identity;
5. only then finish the legacy database cleanup.

That slice fixes a current runtime defect, establishes the boundary pattern the rest
of the architecture will follow, and gives immediate value without betting the repo
on a large refactor.
