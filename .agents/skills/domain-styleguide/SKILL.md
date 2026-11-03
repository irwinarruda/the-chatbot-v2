---
name: domain-styleguide
description: Use when an entity, value object, invariant, state transition, closed set or shared vocabulary type is added or changed, or anything under src/domain is touched. Also use when the request only says "add a field to a todo", "a message can now ...", "add a status" or "where does this rule go". Not for loading data, HTTP or UI.
---

# Domain styleguide

## Authority

This skill owns what belongs in `src/domain` and how it is written. How a use case runs comes from `server-service-styleguide`. Wire shapes come from `contracts-styleguide`.

## Boundary

- `src/domain/<area>/` imports only `zod`, `uuid` and `~/domain/*`. No Node, no framework, no environment, no I/O. `tests/architecture.test.ts` enforces it.
- Both the server and the client may import the domain; nothing in the domain imports either.

## Entities are classes

The Chatbot keeps DDD entities as classes, where favo-cli uses zod objects, because chats, messages and credentials carry identity and real transitions.

- A class exists when it protects identity, a lifecycle, invariants or state transitions (`Chat`, `Message`, `Todo`, `User`). Commands, criteria and projections are plain types.
- Creation goes through the constructor; restoration from storage goes through `static restore(...)`, which skips creation-only defaults. Keep the two input types explicit (`TodoConfig`, `RestoredTodoConfig`).
- Change state only through named methods (`todo.reschedule(date)`, `chat.addToolResult(...)`), never by assigning fields from outside.
- A broken invariant throws a domain error from `src/domain/shared/domain-errors.ts`, without HTTP status, copy for the UI or provider details.
- Entities stamp `createdAt` and generate ids today. A new rule that depends on "now" takes the time as an argument instead.

## Vocabulary

- Closed sets are const objects with `ValueOf`, members in PascalCase as the codebase uses them (`TodoStatus.Pending`). Never a TS `enum`.
- Types shared across layers that are not wire shapes (service commands such as `CreateTodoDTO`, gateway vocabulary such as `AiModelSelectionDTO`) live here as `<area>/<thing>-commands.ts` or `<area>/<thing>.ts`, with the `DTO` suffix on the type name.
- Pure rules that are not an entity method are named functions in their own file (`ai-context-compaction-policy.ts`, `chat-command.ts`).

## Working references

- `src/domain/chat/chat.ts` and `message.ts`: an aggregate with transitions and restore.
- `src/domain/todos/todo.ts`: a small entity with creation and restore inputs.
- `src/domain/chat/ai-context-compaction-policy.ts`: a rule as a pure function.

## Checklist

1. No import outside `zod`, `uuid` and `~/domain/*`.
2. Each new rule has a test in `tests/domain/<area>/` that fails without it.
