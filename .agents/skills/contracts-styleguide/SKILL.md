---
name: contracts-styleguide
description: Use when an HTTP request, response or SSE event, an AI tool input, or a mapper from an entity to a response is added or changed, or anything under src/contracts is touched. Also use when the request only says "the client needs this field", "change this response", "add a tool argument" or "validate this payload". Not for rules, which belong to domain-styleguide.
---

# Contracts styleguide

## Authority

This skill owns the language between the outside and the backend. The browser speaks `src/contracts/http`; the AI model speaks `src/contracts/tools`. Both sides parse the same schemas, so there is one shape per payload.

## Rules

- One file per area and payload family: `http/<area>/<thing>.ts` for requests, responses and events; `tools/<area>/<tool-name>.ts` for one tool's input.
- Export the zod schema and its inferred type under the same PascalCase name ending in `DTO`, with the role before it: `CreateTodoRequestDTO`, `TodoResponseDTO`, `WebChatResponseEventDTO`, `CreateTodosToolDTO`. Never a handwritten interface beside a schema.
- Parse at the first owned boundary: controllers parse requests, tools parse their arguments before acting, client repositories parse responses. Never cast `response.json()`.
- Wire payloads are camelCase JSON. Dates travel as ISO strings.
- Mappers from entities to responses live beside the schema as `http/<area>/<area>-mapper.ts` and return a parsed response DTO.
- The package imports only `zod`, `~/domain/*` and `~/contracts/*`. Reuse a domain type when the wire shape is the domain shape.
- Every tool input is a named schema, including an empty object.

## Working references

- `src/contracts/http/todos/todo.ts` with `todo-mapper.ts`: request, response and mapper.
- `src/contracts/http/chat/chat.ts`: SSE events as a discriminated union.
- `src/contracts/tools/cash-flow/add-transaction.ts`: a tool input.

## Checklist

1. The schema and type share a name ending in `DTO`.
2. A valid and an invalid example in `tests/contracts/<area>/`, and a round trip through the real mapper when there is one.
