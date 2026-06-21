---
name: code-guide
description: Apply the user's preferred TypeScript, JavaScript, React, Zustand, import, whitespace, and code organization style. Use this skill whenever creating, editing, reviewing, or refactoring code, especially when style choices are not already dictated by a stricter local convention.
---

# Coding Styleguide

## Overview

Apply these preferences while preserving the surrounding codebase's established conventions. Treat this skill as a tie-breaker for style decisions, not as permission for broad unrelated refactors.

## Formatting Baseline

When the project uses Biome, follow its mechanical output:

- 2-space indentation
- double quotes
- semicolons always
- trailing commas
- 80 character line width
- `noExplicitAny` may be disabled by the project

Run or trust the formatter rather than hand-tuning mechanical formatting.

## Core TypeScript Style

Prefer code that is direct, local, and easy to scan.

- Prefer `const` by default. Use `let` only when reassignment is necessary. Avoid `var`.
- Prefer inferred variable and function return types when TypeScript can express the same contract clearly.
- Add explicit types when they define a public contract, satisfy an interface, improve a generic boundary, or prevent overly wide inference.
- Do not use `null` in application types, DTOs, interfaces, or component props. Use `undefined` or optional properties instead.
- SQL is the exception: the `postgres` driver needs JavaScript `null` to bind SQL `NULL` values. Keep `undefined` throughout the application layer, then convert to `null` at the query boundary only.
- Do the SQL conversion as close to the query as possible with `?? null`, usually directly in the parameter object or values list. Do not let SQL-specific `null` values leak back into DTOs, entities, service contracts, component props, or general application state.
- Prefer named functions over anonymous functions when a useful name improves readability, reuse, stack traces, or tests.
- Anonymous callbacks are fine for short inline operations or third-party callback APIs.

## Class and Function Organization

Keep class logic inline by default. Do not split logic into private helpers only to make a class look smaller. Extract a separate method only when the same logic is reused more than once in that class, or when the extraction gives the code a genuinely clearer concept that a named local variable or short comment cannot convey.

A private method with a single caller is usually a missed inline. Prefer a well-named local variable, or a short comment, over a one-use helper. If a calculation fits in one expression, keep it where it is used rather than hiding it behind a call.

When a function needs `try`/`catch` or `try`/`finally`, prefer wrapping the whole function body in the `try` block. This keeps guards, reads, state updates, and cleanup in one protected linear flow. A narrower `try` is acceptable only when the function truly has independent phases and only one phase needs protection.

## Whitespace

Avoid decorative blank lines inside a single scope. Keep statements that form one immediate thought together.

Do not add blank lines inside:

- `if` / `else`
- `switch`
- loops
- `try` / `catch` / `finally`
- object literals
- array literals
- Zustand slices or stores
- short helper functions
- JSX expression trees or prop groups

Use empty lines between distinct top-level scopes such as separate functions, methods, class members, or clearly separated groups inside React components. Keep consecutive constant declarations together without blank lines.

Remove blank lines between a variable and the `if`, `return`, or call that immediately uses it. In tests, avoid unnecessary arrange/act/assert blank lines when the flow remains easy to scan without them.

## React Style

Within React components, prefer this order when it does not create churn or fight a clear local pattern:

1. Props destructuring, constants, refs, state, and direct variables.
2. Computed values, derived data, memoized values, and selectors.
3. Event handlers, helper functions, async actions, and render helpers.
4. Effects and subscriptions.
5. Return JSX.

A single blank line is acceptable between grouped concerns such as constants, local functions, `useCallback`, `useMemo`, and `useEffect` blocks. Keep one blank line before the component `return`. Do not add blank lines within one group.

Prefer event handler names like `onProjectModalOpen`, `onProjectFormSubmit`, and `onProjectNameChange` instead of `handleProjectModalOpen`, `handleProjectFormSubmit`, or `handleProjectNameChange`.

For conditional JSX with no meaningful else branch, prefer boolean-safe `&&` rendering:

```tsx
{isVisible && <Panel />}
```

Make sure the condition is actually boolean so React does not render unintended values like `0` or a string.

Prefer locality of behavior. Keep small, tightly coupled components near the parent component in the same file. Move a component to another file when the file is becoming hard to scan, the component is reused elsewhere, it has independent behavior or ownership, or the surrounding module already has a splitting pattern.

## Error Handling Wrappers

When a component uses `useError()`, keep event handlers focused on the domain action and apply `error.handle()` or `error.handleSync()` where the callback is passed to JSX or component props.

```tsx
async function onDashboardRefreshClick() {
  await loadDashboard();
}

<Button onClick={error.handle(onDashboardRefreshClick)} />
```

Use `error.handle()` for async callbacks and `error.handleSync()` for synchronous callbacks. Avoid calling `error.handle*` inside the event handler body when the wrapper can live at the binding site.

## Zustand Style

In Zustand stores, never access state as `get().someVariable`. Destructure values from `get()` first:

```ts
const { selectedProjectId } = get();
```

This keeps state reads explicit and avoids repeated `get()` calls hidden in expressions.

## Import Paths

Avoid relative parent imports that traverse upward with `../` when the project has an alias such as `@/*`. Use the configured alias instead. Relative imports are acceptable for items in the same directory or a direct subdirectory.

```ts
import { Button } from "@/shared/components/Button";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import SubComponent from "./SubComponent";
import Helper from "./helpers/Helper";
```

Avoid imports like `../../shared/components/Button` or `../auth/hooks/useAuth` when an alias exists. Stable alias imports make refactoring safer and avoid `../../..` chains.

## Applying The Style

Match formatter output and lint rules first. Prefer focused edits that improve touched code without restyling unrelated areas. If existing code in the file consistently uses a different style, follow the file unless the user explicitly asks to migrate it.
