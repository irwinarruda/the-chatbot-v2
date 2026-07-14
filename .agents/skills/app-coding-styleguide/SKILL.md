---
name: app-coding-styleguide
description: "Authoritative non-visual TypeScript/JavaScript styleguide for The Chatbot: naming, inference, classes versus functions, DTOs and runtime schemas, imports, whitespace, errors, locality, Services, entities, gateways, client services, stores, and tests. Use whenever creating, editing, reviewing, or refactoring application code. For TSX/JSX, components, Tailwind, or user-facing UI, also use client-jsx-styleguide."
---

# App Coding Styleguide

## Source of truth and precedence

This skill owns non-visual TypeScript/JavaScript style across entities, DTOs,
Services, gateways, contracts, client services, stores, and tests. TSX/JSX visual
implementation belongs to `client-jsx-styleguide`.

Precedence:

1. The user's explicit request, scoped `AGENTS.md`, and a clear surrounding pattern.
2. Biome, TypeScript, and project configuration.
3. This skill as the default implementation style.

Keep edits focused. Tidy touched code when cheap; do not restyle unrelated files.

## Purpose

Write direct, local code that is easy to scan and hard to misuse. Architecture
belongs in `app-architecture`; service and contract mechanics belong in
`app-service-boundaries`; state placement belongs in `client-state-management`.
This skill is the implementation-style tie-breaker.

Match a clear local convention before introducing churn. Apply these rules naturally
to touched code rather than restyling unrelated files.

## Formatting baseline

Trust Biome:

- 2-space indentation;
- double quotes;
- semicolons;
- trailing commas;
- 80-character line width.

Run the formatter instead of hand-tuning mechanical layout.

## Core TypeScript style

- Prefer `const`. Use `let` only for real reassignment. Never use `var`.
- Prefer inferred local and return types when inference expresses the same contract.
- Add explicit types for public contracts, interfaces, generic boundaries, and cases
  where inference becomes wider or less useful.
- Give lifecycle boundaries plain named input types. Do not construct a public
  method or factory signature with mapped-type puzzles such as
  `Required<Pick<Config, ...>> & Config`; repeat the fields in an explicit contract
  when that makes creation and restoration requirements obvious.
- Use `undefined` or optional properties in application types. Avoid `null` outside
  protocol and SQL boundaries.
- Convert `undefined` to SQL `NULL` with `?? null` directly at the query boundary.
- Prefer named functions when a useful name improves readability, reuse, stack
  traces, or tests.
- Keep short third-party callbacks anonymous when a name would add noise.
- Do not use ternary expressions. Use an explicit branch, lookup, or named
  selection instead.
- Prefer composition over inheritance.
- Keep provider types private to their gateway implementation unless they are an
  owned module DTO.

## Classes and plain functions

Use a class for identity, lifecycle, stateful behavior, or constructor-injected
dependencies. Use a plain named function for pure transformations and stateless
helpers.

Do not wrap stateless utility functions in static-only classes. Do not create a class
because the file lives under `utils`. React hooks remain functions.

Keep logic inline by default. Extract when:

- the logic is reused;
- the name introduces a real concept;
- it isolates a difficult pure transformation;
- it owns an independent lifecycle or responsibility.

A one-use private helper that merely shortens a method is usually missed locality.

## DTOs and runtime schemas

Declare every type, interface, or schema whose name ends in `DTO` inside an
`entities/dtos/` directory. Browser-only DTOs may use the feature's
`client/entities/dtos/`; module API, Service, gateway, and tool DTOs use the
module-root `entities/dtos/`.

Use Zod when data crosses an owned runtime boundary such as HTTP, SSE, untrusted
storage, tool input, or environment input.

Export the schema value and inferred type with the same PascalCase name. Use a suffix
that describes the owned boundary role (`Request`, `Response`, or `Event`) rather
than vague `Schema` or `DTO` suffixes:

```ts
export const CreateTodoRequest = z.object({
  name: z.string().trim().min(1),
  dueDate: z.iso.datetime().optional(),
});

export type CreateTodoRequest = z.infer<typeof CreateTodoRequest>;
```

Keep the schema in the owning module's `entities/dtos/`. Put it in
`src/shared/entities/dtos` only when no feature owns the primitive.

Do not maintain a handwritten interface beside the schema. Do not assert
`response.json() as ResponseDTO`; parse it.

Internal commands that never cross a runtime trust boundary may be plain types.

AI tool inputs use an explicit `DTO` suffix. Export the Zod schema and inferred type
with the same `*ToolDTO` name from the owning module's `entities/dtos/` folder, even when the
schema is an empty object. Tool registries import and parse these DTOs; never define
tool input schemas inline or introduce a shared generic empty-input DTO.

## Closed value sets

Model application-owned closed string sets as const objects plus `ValueOf`:

```ts
export const ToolResultStatus = {
  Succeeded: "succeeded",
  Failed: "failed",
  Unknown: "unknown",
} as const;

export type ToolResultStatus = ValueOf<typeof ToolResultStatus>;
```

Compare through the member, not a repeated raw literal. Raw string unions/literals
are acceptable when an external protocol owns the values and the type stays inside
its gateway implementation.

## Naming

- Use names that state the domain action or value, not the implementation mechanism.
- Service public methods should read as capabilities.
- Use `on{Name}{Event}` for React handlers: `onTodoCreate`, `onMessageSend`.
- Avoid `handle{Name}` when the code expresses user intent.
- Name gateway implementations by provider or mechanism plus capability. Put the
  interface in `gateway/<Name>Gateway/index.ts` without an `I` prefix.
- Name persistence collaborators for the real aggregate/capability, never
  `BaseRepository` or `GenericDAO`.
- Spell acronym suffixes consistently in uppercase, including `DTO`; use
  `CreateTodoDTO`, never `CreateTodoDto`, in identifiers and filenames.
- Do not prefix interfaces with `I` in new code. The type's role and location should
  make the abstraction clear.

Existing names may remain during focused work; do not create rename churn unrelated
to the requested change.

## Comments

Code should explain itself through names, types, and structure. Do not add comments
that narrate the code, restate a condition, announce a refactor, or explain syntax.

A short rationale comment is allowed when the constraint cannot be made obvious in
code, especially for:

- an external protocol/provider quirk;
- a security constraint;
- a migration compatibility requirement;
- a counterintuitive invariant whose obvious simplification would be wrong.

Keep that comment about **why**, not **what**. Remove it when the constraint
disappears.

## Function organization

Prefer a linear reading order:

1. guards and input normalization;
2. source reads;
3. entity/Service action;
4. persistence/effects;
5. return value.

When a function needs `try`/`finally`, wrap the full protected workflow so cleanup
runs even when an early read or guard throws. Use a narrower `try` only when the
function genuinely has independent phases.

Avoid `try/catch` by default. Catch only for recovery, rollback, cleanup, explicit
fallback, or meaningful error translation at a boundary. Never catch only to log and
rethrow or turn every failure into the same generic error.

## Whitespace

Keep statements that form one thought together. Avoid decorative blank lines inside:

- guards and branches;
- loops;
- `try`/`catch`/`finally`;
- object and array literals;
- short functions;
- slice definitions;
- JSX prop groups and expression trees.

Use one blank line between distinct top-level declarations, class members, React
function/effect groups, or genuinely separate phases of longer logic.

Do not separate a value from the `if`, call, or return that immediately uses it.

## React organization

Within a component, prefer:

1. props, constants, refs, state, and direct selectors;
2. derived and memoized values;
3. event handlers and render helpers;
4. effects and subscriptions;
5. JSX return.

Keep one blank line between function, memo, callback, and effect groups, and one
before the return. Do not force the order when it creates unrelated churn.

For conditional JSX without a meaningful else branch, use boolean-safe `&&`:

```tsx
{isVisible && <Panel />}
```

Keep tightly coupled small components in the same file. Move one out when it is
reused, independently owned/tested, or the file has become hard to scan.

## UI error wrappers

Keep handlers focused on the action and bind error wrappers where the callback is
passed:

```tsx
async function onChatRefresh() {
  await loadChat();
}

<Button onClick={error.handle(onChatRefresh)} />
```

Use the async/sync wrapper that matches the callback. Do not invoke the wrapper from
inside the handler when it can live at the binding site.

## Zustand implementation style

Destructure values from `get()` before use:

```ts
const { selectedTodoId, todos } = get();
```

Do not scatter repeated `get().field` expressions through an action. Select narrow
fields/actions in React components rather than the whole store. Never call
`useApp.getState()` from render code or hooks.

State ownership and async lifecycle rules live in `client-state-management`.

## Imports

Use the configured `~/*` aliases for imports that cross directories:

```ts
import { Button } from "~/shared/client/components/ui/button";
import { Chat } from "~/modules/chat/entities/Chat";
```

Use `./` for same-directory files or direct subdirectories. Avoid `../` parent
traversal. Import types with `import type` when they are type-only.

Avoid barrels that hide ownership or create cycles. Prefer the module's explicit
published entrypoint or concrete published path.

## Tests

- Name tests after observable behavior.
- Keep setup focused on what the behavior needs.
- Prefer gateway and Service fakes over provider SDK mocks.
- Avoid decorative arrange/act/assert comments and blank-line rituals.
- Assert through public behavior; inspect internal state only when that state is the
  contract under test.

## Final check

Before finishing touched code, ask:

- Is the behavior local and obvious?
- Did I add a type/class/helper that does not earn its existence?
- Is runtime data parsed rather than asserted?
- Are errors caught only where recovery or translation happens?
- Does the import path reveal the correct owner?
- Did I preserve the surrounding code instead of creating unrelated churn?

## Related skills

- `app-architecture` — ownership, placement, DDD/OOP, and dependency direction.
- `app-service-boundaries` — contracts, side effects, persistence, and errors.
- `client-state-management` — client state ownership and lifecycle.
- `client-jsx-styleguide` — TSX/JSX, components, Tailwind, and visual behavior.
- `app-tests` — test-specific style and harness rules.
