---
name: client-tests
description: Use whenever creating, editing or fixing tests for src/client: Zustand service tests with fake repositories, parser tests, and view tests with Testing Library in jsdom. Also use when the request only says "add a test for this screen" or "this client test is flaky".
---

# Client tests

Tests mirror ownership under `tests/client/<module>/`. A `.test.ts` runs in Node with the main Vitest config; a `.test.tsx` runs in jsdom through `vitest.ui.config.ts` (`bun run test:ui`), with `tests/support/setup-ui.ts`.

- **Service tests**: register a fake port, `container.register("TodoRepository", repository)`, build a store from the creator, `create<Service>()(computed(createTodoService))`, then drive actions and assert source state, computed state and the calls the fake received. Use `createDeferred` from `tests/support/create-deferred.ts` to control races.
- **Parser tests**: pure input and output, no store.
- **View tests**: only for interaction, accessibility, focus or conditional rendering. Query by role, label and visible text; never by class name. Do not repeat a service test through the DOM.

View tests run on the real adapters: `tests/support/setup-ui.ts` calls `bootstrapAppContainer()` before each test, and a test stubs `fetch` or spies on an adapter. A fake implements the port and nothing more. Read fresh state with `store.getState()` after an action; a destructured snapshot is stale. Never call the network; a view test that needs data seeds the store.

## Working references

- `tests/client/todos/TodoService.test.ts`: races and stale results.
- `tests/client/chat/ChatScreen.test.tsx`: a screen driven through its store.

## Checklist

1. The test proves behavior through public actions or what the user can see.
2. It passes alone and in `bun run test:unit` or `bun run test:ui`.
