---
name: coding-styleguide
description: Use when writing, editing or reviewing any TypeScript or TSX in The Chatbot: names, types, null versus undefined, functions, classes, imports, try blocks, comments, file names and test names. Also use when the request only says "add a helper", "rename this" or "clean this up".
---

# Coding styleguide

## Authority

This skill owns how code reads. Where code lives comes from `server-architecture` and `client-architecture`. JSX and visual rules come from `client-jsx-styleguide`.

## Rules

- Biome owns formatting and import order. Do not hand-tune what `bun run check:fix` decides.
- `const` by default, `let` only for real reassignment, never `var`.
- Let TypeScript infer variables and return types. Annotate public contracts: gateway and repository interfaces, service inputs and exported creators.
- `undefined` in application types. `null` only where SQL or an external protocol forces it, converted at that boundary.
- `??` instead of `||` for defaults.
- Function declarations for named functions; arrows for callbacks. No nested ternaries; use an explicit branch or a lookup.
- A class for identity, lifecycle or constructor-injected dependencies; a named function for a pure transformation. No static-only classes for new helpers.
- When a function needs `try`, open it at the top so the whole body lives inside. Catch only to translate, recover or clean up.
- Keep logic inline. Extract for reuse, a real concept or an isolated hard transformation, never to shorten a file.
- Closed sets are const objects with `ValueOf`, never a TS `enum`.
- Booleans read as `is*`, `has*`, `can*`, `should*`. Module constants follow the case the surrounding file already uses.
- Types that cross a boundary end in `DTO`, never `Dto`.
- No comments in production code. The reason goes in a name, a test or a skill. Only `// biome-ignore` with its justification and `/// <reference>` are allowed; vendored shadcn primitives keep upstream comments.
- No `../` imports. Use `~/` across folders and `./` only within one folder. No barrels.

## File names

| Where                          | Style                                                                 | Example                                         |
| ------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------- |
| `src/domain`, `src/contracts`  | kebab-case, no role                                                   | `todo.ts`, `chat-command.ts`                    |
| `src/server`                   | kebab-case `<name>.<role>.ts`; a gateway implementation puts its mechanism first | `todo.service.ts`, `pi.ai-chat.ts`  |
| `src/client`                   | PascalCase for services, repositories, gateways and components; screens are folders with `index.tsx`; shadcn primitives stay kebab-case | `TodoService.ts`, `TodoRow.tsx` |
| `tests/`                       | the file under test, `.test.ts(x)`                                     | `todo-service.test.ts`, `TodoRow.test.tsx`      |

## Checklist

1. `bun run check` passes without new suppressions.
2. No `null` outside a boundary, no `||` default, no TS `enum`, no comment, no `../`. The architecture test checks the last three.
3. Test names describe behavior in domain words.
