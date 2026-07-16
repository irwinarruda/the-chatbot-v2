---
name: app-tests
description: "Authoritative guide to writing and placing The Chatbot tests with Vitest and PostgreSQL. Use whenever adding, editing, reviewing, or debugging entity, DTO, Service, gateway, client-state, UI, database, migration, provider, or realtime tests, including fixtures, fakes, builders, assertions, and coverage."
---

# App Test Styleguide

## Source of truth and precedence

The implemented test tree, `vitest.config.ts`, DTO schemas, test composition root,
and database harness are the source of truth.

Precedence:

1. The user's explicit request and scoped `AGENTS.md`.
2. The nearest established pattern at the same test level.
3. Vitest/project configuration.
4. This skill as the default testing standard.

## Choose the narrowest level

1. **Entity** — invariants and transitions without DI or PostgreSQL.
2. **DTO** — Zod requests/responses/events plus real boundary mapping.
3. **Service** — workflows with deterministic gateways or database fakes.
4. **Client state** — slice actions, selectors, hydration, optimistic/realtime
   reduction, resets, and SSR isolation.
5. **Gateway integration** — concrete provider/protocol mapping and failures.
6. **Database integration** — PostgreSQL SQL, migrations, transactions, constraints,
   hydration, and concurrency.
7. **UI** — interaction, accessibility, focus, keyboard, or rendering behavior that
   cannot be proved more directly.

The external mechanism under test determines the level. A class named `Service` does
not automatically make its test an integration test.

## Placement

Keep tests centralized and grouped by level:

```text
tests/
  entities/<module>/
  dtos/<module>/
  services/<module>/
  client/<module>/
  integration/
    gateways/<module>/
    database/<module>/
  architecture/
  utils/
    builders/
    fakes/
    fixtures/
    createTestApplication.ts
```

Do not co-locate tests in production module directories.

Name files after the behavior owner:

```text
tests/entities/chat/Chat.test.ts
tests/dtos/chat/ChatDTO.test.ts
tests/services/chat/MessagingService.test.ts
tests/client/chat/chatSlice.test.ts
tests/integration/gateways/chat/PiAiChatGateway.test.ts
tests/integration/database/chat/ChatPersistence.test.ts
```

## Commands

Use Bun from the repository root:

```bash
bun run test
bun run test:coverage
bun run test -- <file-or-pattern>
```

Run the narrowest relevant test while iterating, then the full suite before handoff
when the environment supports it. Entity, DTO, Service, and client-state tests must
not require PostgreSQL. Database integration tests own their schema and migration
lifecycle.

## Standard shape

Use `describe` and `test`, not `it`. Name tests after observable behavior:

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

Keep setup, action, and assertion readable without mandatory arrange/act/assert
comments. One file should have one clear public behavior owner.

## Entity tests

Construct real entities through public constructors or `create`/`restore` factories.
Test valid construction, rejected invalid state, transitions, timestamps, aggregate
consistency, and public value-object behavior.

Do not mock, inspect private fields, or test trivial getters and TypeScript types.

## DTO tests

Exercise the real boundary:

1. Produce the real entity or Service result.
2. Run the production mapper.
3. Parse the result with the owning Zod DTO.
4. When valuable, pass it through the client parser or reducer.

Test valid data, rejection, optional fields, error payloads, and discriminated event
variants. Do not only parse a fixture designed to match the schema.

## Service tests

Create the Service through the typed test application factory or a focused
constructor with deterministic gateway/database fakes.

Test workflow ordering, public outcomes, entity coordination, transaction and
partial-failure decisions, error translation, tool idempotency, retry decisions, and
explicit cross-feature coordination.

Do not import concrete production provider gateways. Do not start PostgreSQL unless
SQL or PostgreSQL behavior is the subject.

## Client-state tests

Create slices with deterministic client-service dependencies. Read and act through
the public state/action surface.

Test URL hydration, source versus derived state, loading/submitting cleanup,
authoritative reconciliation, optimistic correlation, failure/retry, stream ordering,
stale generations, reset/lifecycle cleanup, and SSR isolation.

Read fresh state after actions; do not assert against a stale destructured snapshot.

## Gateway integration tests

Use minimal provider fixtures or a local protocol fake. Verify serialization,
normalization, authentication/signatures, provider error translation, and real
protocol quirks.

Do not test the provider SDK itself. Never let a test flag silently select a live
external provider.

## Database integration tests

Use PostgreSQL only for raw SQL, migrations/backfills, transactions, constraints,
deduplication, concurrency, or hydration/restoration.

The integration harness owns readiness, migrations, and cleanup. Tests must not
depend on order or shared mutable rows.

## Realtime tests

Gateway tests cover reconnect, backoff, cancellation, cursor transmission, resume,
duplicates, ordering, and terminal stop behavior.

Slice tests cover persisted identity, optimistic correlation, stale subscription
generations, committed progress, and connection state visible to the UI.

## UI tests

Add a UI test only when interaction, accessibility, focus, keyboard behavior, or
conditional rendering is the behavior. Prefer role, label, and visible-text queries.

Avoid implementation selectors, class-name assertions, and snapshots for interactive
behavior. Do not repeat a slice test through the DOM for coverage.

## Fakes, fixtures, and builders

Prefer small deterministic fakes at real gateway interfaces over broad `vi.mock`
replacement.

A fake should implement the production-facing interface, expose only needed controls,
reset cleanly, and never call a real network/browser/provider.

Build entity data through public factories. Put reusable builders under
`tests/utils/builders`; keep one-test data local until it is reused. Provider-shaped
fixtures belong only in gateway integration tests.

## Assertions

Assert the smallest public outcome that proves behavior:

- `toBe` for primitives/identity;
- `toEqual` for owned structural output;
- `toMatchObject` for focused partial structure;
- `toHaveLength` for collection size;
- `toBeDefined`/`toBeUndefined` for presence;
- `toBeInstanceOf` when restored class identity matters;
- `toThrow(ErrorType)` or `rejects.toThrow(ErrorType)` for failures.

Assert specific entity or Service errors when their type is part of the contract.

## Isolation

Every test starts from deterministic state. Reset gateway requests, timers, stores,
subscriptions, storage, and database rows through the owning harness. Do not depend
on test order or share mutable entity instances.

## Architecture tests

Keep architecture tests for the decisions that make the simplified shape real:

- no `domain/`, `application/`, `server/`, or `services/ports/`;
- entity dependency direction;
- Services and gateways do not import client code;
- each gateway directory contains `index.ts`;
- every DTO declaration uses the uppercase `DTO` suffix and lives in an
  `entities/dtos/` directory;
- `contracts/` contains no Zod schema declarations.

## Checklist

1. Choose the narrowest test level.
2. Place it in the centralized matching directory.
3. Use public behavior and real production mapping.
4. Use deterministic fakes at gateway interfaces.
5. Keep PostgreSQL and provider mechanics in integration tests.
6. Assert focused observable outcomes and specific errors.
7. Reset all owned state and effects.
8. Run the focused test, then the relevant/full suite.

## Related skills

- `app-architecture` — production ownership and dependency direction.
- `app-service-boundaries` — DTOs, gateways, SQL, transactions, and errors.
- `app-coding-styleguide` — implementation style.
- `client-state-management` — slice, SSR, and realtime behavior.
- `client-jsx-styleguide` — UI and accessibility conventions.
