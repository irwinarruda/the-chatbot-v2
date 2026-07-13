---
name: app-tests
description: "Authoritative guide to writing and placing The Chatbot tests with Vitest and PostgreSQL. Use whenever adding, editing, reviewing, debugging, or asking about tests, coverage, test placement, fixtures, generators, fakes, mocks, assertions, domain tests, application Service tests, contract tests, Zustand/client-state tests, SSE tests, provider adapter tests, database integration tests, migrations, or anything touching *.test.ts/tsx, even if the user does not say test architecture."
---

# App Test Styleguide

## Source of truth and precedence

The implemented test tree, `vitest.config.ts`, test application factory, contract
schemas, and database integration harness are the source of truth.

Precedence:

1. The user's explicit request and scoped `AGENTS.md`.
2. The nearest established test pattern for the same test level.
3. Vitest/project configuration.
4. This skill as the default testing standard.

This skill owns test placement, harnesses, fakes, fixtures, and assertion style.
Production placement belongs to `app-architecture`; implementation style belongs to
`app-coding-styleguide`.

## First decision: choose the test level

Use the narrowest level that proves the owned behavior.

1. **Domain** — entity/value-object invariants and transitions; no DI or database.
2. **Application** — Service workflows with deterministic outbound-port/database
   fakes when persistence mechanics are not the subject.
3. **Contract** — Zod HTTP/SSE schemas plus real server/client mapping.
4. **Client state** — slice actions, selectors, URL hydration, optimistic/realtime
   reduction, resets, and SSR isolation with deterministic client services.
5. **Integration** — PostgreSQL SQL/migrations/transactions/hydration or concrete
   provider adapter mapping.
6. **UI** — interaction, accessibility, or rendering behavior that cannot be proven
   more directly through state/application/contract tests.

Do not call every Service test an integration test. The external mechanism under
test determines the level.

## Placement

Keep one centralized test tree that mirrors architectural ownership:

```text
tests/
  domain/<module>/
  application/<module>/
  contracts/<module>/
  client/<module>/
  integration/database/<module>/
  integration/adapters/<module>/
  utils/
    builders/
    fakes/
    fixtures/
    createTestApplication.ts
```

Do not co-locate `*.test.ts`/`*.test.tsx` inside production module folders. A
centralized tree keeps test infrastructure out of the production graph and gives
each test level one obvious home.

Name files after the public behavior owner:

```text
tests/domain/chat/Chat.test.ts
tests/application/chat/ChatService.test.ts
tests/contracts/chat/ChatContracts.test.ts
tests/client/chat/chatSlice.test.ts
tests/integration/database/chat/ChatPersistence.test.ts
```

## Commands

Use `bun` from the repository root:

```bash
bun run test
bun run test:coverage
bun run test -- <file-or-pattern>
```

Run the narrowest relevant file/pattern while iterating, then the full suite before
handoff when the environment supports it. PostgreSQL integration tests require the
test database and own their schema/migration lifecycle. Domain, application,
contract, and client-state tests must not require PostgreSQL.

## Standard test shape

Use `describe` and `test`, not `it`. Write behavior sentences:

```ts
describe("Chat", () => {
  test("tool result completes the matching persisted call", () => {
    const chat = createChat();
    const call = chat.addToolCall(createToolCall());

    chat.addToolResult(createToolResult(call));

    expect(chat.getToolResult(call.callId)).toBeDefined();
  });
});
```

Keep setup, action, and assertion visually readable without mandatory
arrange/act/assert comments. Use a blank line only when it separates meaningful
phases.

One file should have one clear public behavior owner. Nested `describe` blocks may
group several cases of one capability.

## Domain tests

Construct real entities through public `create`/`restore` factories. Test:

- valid construction and normalized state;
- rejected invalid state;
- transitions and timestamps;
- aggregate consistency;
- value-object equality/serialization only when it is public behavior.

Do not mock. Do not inspect private fields. Do not test trivial getters or TypeScript
types.

## Application tests

Create the Service through the typed test application factory or a focused
constructor with deterministic port fakes.

Test:

- workflow ordering and public outcomes;
- domain behavior coordination;
- transaction/partial-failure decisions at the application level;
- error translation owned by the application;
- tool idempotency, retry decisions, and unknown outcomes;
- direct cross-feature coordination through published capabilities.

Do not import concrete production provider adapters. Do not start PostgreSQL merely
because the production Service uses raw SQL; inject a deterministic database
executor fake unless SQL itself is under test.

## Contract tests

Contract tests must exercise the actual production mapping seam:

1. produce the real application/domain result;
2. run the controller/event mapper;
3. parse through the shared Zod response/event schema;
4. when valuable, feed that result through the client service/reducer parser.

This prevents server and client from independently inventing compatible-looking
wire shapes.

Test success, optional fields, error payloads, and discriminated event variants. Do
not test only a fixture created to match the schema.

## Client state tests

Create slices through typed factories with deterministic client-service dependencies.
Read and act through the public state/action surface.

Test:

- URL/search hydration and invalid params;
- source versus derived state;
- loading/submitting cleanup on success and failure;
- authoritative mutation, refresh, or stream reconciliation policy;
- optimistic correlation, failure, and retry;
- keyed stream replacement and stale-generation rejection;
- resets and lifecycle cleanup;
- SSR isolation with two different request snapshots.

Use a live state getter after actions rather than holding a stale destructured
snapshot.

## Integration tests

Use real PostgreSQL only for behavior that depends on PostgreSQL:

- raw SQL and row mapping;
- migrations and backfills;
- transaction rollback/commit;
- constraints and deduplication;
- optimistic concurrency;
- aggregate hydration/restoration;
- destructive migration audit queries.

The integration harness owns database readiness, migration, and schema cleanup. Keep
tests isolated from order and shared mutable rows.

Concrete provider adapter tests use recorded/minimal provider fixtures or a local
protocol fake. They verify mapping, authentication/signature logic, provider error
translation, and protocol quirks—not the provider's own SDK implementation.

Never allow a test environment flag to select a real external provider silently.

## Realtime tests

Test stream mechanics and state reduction separately.

Adapter tests cover:

- reconnect/backoff/cancel;
- stable event ID/cursor transmission;
- replay versus snapshot resume;
- duplicate and out-of-order delivery;
- terminal stop behavior.

Slice/reducer tests cover:

- exact persisted identity;
- correlation of optimistic and canonical items;
- stale subscription generations;
- committed progress only;
- connection state visible to the UI.

## UI tests

Add a UI test when user interaction, accessibility, focus, keyboard behavior, or
conditional rendering is the owned behavior. Use the shared render harness and
high-level user actions.

Prefer queries by role, label, and visible text. Avoid implementation selectors,
class-name assertions, and snapshots for interactive behavior.

Do not duplicate a slice test through the DOM merely to increase coverage.

## Fakes, fixtures, and builders

Prefer hand-written deterministic fakes at real ports over broad `vi.mock` module
replacement.

A fake should:

- implement the production-facing contract;
- expose only the request/outcome controls tests need;
- reset cleanly between tests;
- never make real network/browser/provider calls.

Build domain data through public factories. Put reusable builders/generators under
`tests/utils/builders`; keep a one-test request/contract factory local until a second
file needs it.

Use provider fixtures only at adapter boundaries. Do not leak provider-shaped data
into domain/application tests.

## Assertions

Assert the smallest public outcome that proves the behavior:

- `toBe` for primitives/identity;
- `toEqual` for owned structural output;
- `toMatchObject` for focused partial structure;
- `toHaveLength` for collection size;
- `toBeDefined`/`toBeUndefined` for presence;
- `toBeInstanceOf` for domain restoration when class identity matters;
- `rejects.toThrow(ErrorType)` or `toThrow(ErrorType)` for failures.

Assert the specific domain/application error type when the type is part of the
contract. Avoid over-asserting unrelated fields that make tests brittle.

## Isolation and cleanup

Every test starts from deterministic state. Reset fake requests, timers, stores,
subscriptions, storage, and database rows through the owning harness.

Do not depend on test order. Do not share mutable entity instances across tests. Use
fake timers only when real time would make the test slow/flaky, and restore them.

## What not to do

- Do not put tests in production module trees.
- Do not start PostgreSQL for non-integration behavior.
- Do not mock internals when a public port exists.
- Do not assert private fields or call private helpers.
- Do not test a fake's invented mapping instead of the real production mapper.
- Do not use live external providers in the normal suite.
- Do not use route/controller tests when an application or contract seam proves the
  behavior more directly.
- Do not write vague names such as `works` or `test 1`.

## Checklist

1. Choose the narrowest test level.
2. Place the test in the centralized mirrored tree.
3. Use the real public behavior surface.
4. Use deterministic fakes at meaningful boundaries.
5. Build valid domain data through public factories.
6. Exercise real production mapping in contract tests.
7. Keep PostgreSQL/provider mechanics in integration tests.
8. Assert focused observable outcomes and specific errors.
9. Reset all owned state and effects.
10. Run the focused test, then the relevant/full suite.

## Related skills

- `app-architecture` — production ownership and dependency direction.
- `app-service-boundaries` — contracts, providers, SQL, transactions, and errors.
- `app-coding-styleguide` — test implementation style.
- `client-state-management` — expected slice/SSR/realtime behavior.
- `client-jsx-styleguide` — UI and accessibility conventions for approved UI tests.
