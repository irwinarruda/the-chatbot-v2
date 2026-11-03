---
name: client-service-styleguide
description: Always load when creating or changing Zustand services, computed values, async actions, optimistic or streaming state, repository or gateway ports and adapters, URL search state, browser storage, or the store composition in src/client. Also use when the request only says "load this list", "keep this in the URL", "persist this preference" or "stream this response".
---

# Client service styleguide

## Rules

- One flat store, `useApp`, composed in `shared/stores/app.ts` with `composeServices`, which throws on a duplicate key.
- One service per file: the state and action interface, then `create<Name>Service(dependencies)` returning a `StateCreator`, then private helpers at the bottom. A service never imports the store or another service's file; it reads what it needs from `get()`.
- A service receives its repositories and gateways as creator arguments. Never resolve them from a module-level singleton inside an action.
- Keep facts as source state and derive the rest with `compute`: store `selectedTodoId`, derive `selectedTodo`.
- At the start of an action, destructure what it needs from `get()` once.
- `try/finally` for a loading flag, whole body inside. Let errors bubble to the view unless the workflow shows them itself; store an `ApiError` or a typed error code, and let the view turn it into copy.
- Reading another service's state and calling its action is fine. Writing its fields is not.
- Confirmation, navigation, translations and toasts are view decisions. An action receives an already confirmed command.
- Ports are interfaces named for the capability (`TodoRepository`, `AudioInputGateway`); adapters are classes named for the mechanism (`ApiTodoRepository`, `BrowserAudioInputGateway`). An `Api*` adapter parses every response with the contract schema.

## Where state lives

Classify each value in this order; the first fit wins: URL (shareable, survives reload: filters, selected record, flow step), service state (fetched data, workflow and connection state), a derived value, not state at all (returned and used immediately), local React state (drafts, popovers, measurements). The URL is canonical: a service may cache what the URL names but never keeps a second mutable copy.

## Lifecycles

Streaming responses, overlapping requests, optimistic items, media recording and SSR hydration each have rules; read `references/state-lifecycles.md` before touching them.

## Working references

- `src/client/modules/todos/app/services/TodoService.ts`: list, detail and mutations with stale-request protection.
- `src/client/modules/chat/app/services/ChatService.ts`: streaming progress reduced by exact ids.
- `src/client/shared/stores/app.ts`: composition and the session reset.

## Checklist

1. Add the port and its adapter before wiring the action.
2. Register the service in `shared/stores/app.ts`.
3. Test source state, computed state and races through the creator with a fake port.
