---
name: client-jsx-styleguide
description: "Authoritative guide to The Chatbot client JSX/TSX and terminal UI implementation. Use whenever creating, editing, reviewing, or refactoring React screens, components, forms, tables, TSX/JSX layout, shadcn/Base UI primitives, Tailwind classes, theme tokens, chat or todo UI, prose, icons, focus states, responsive behavior, accessibility, or any user-facing interface code, even for a small UI tweak."
---

# Client JSX Styleguide

## Source of truth and precedence

The implemented client UI, shared primitives, and terminal tokens in
`src/client/styles/tailwind.css` are the source of truth. This skill owns TSX/JSX
implementation. Non-visual TypeScript belongs to `app-coding-styleguide`.

Precedence:

1. The user's explicit request, scoped `AGENTS.md`, and an intentional nearby pattern.
2. `src/client/styles/tailwind.css`, terminal tokens, and shared UI primitives.
3. This skill as the default client UI implementation guide.

Keep diffs focused. Do not restyle unrelated JSX or Tailwind classes.

Read `references/terminal-design-system.md` when the task needs exact colors, token
values, page shells, component recipes, chat/todo patterns, prose styling, animation,
or icon semantics. Do not load it for a purely structural JSX edit.

## First decision: reuse before creating

Before implementing UI:

1. Inspect the nearest analogous screen/component.
2. Search shared terminal components and `src/shared/client` primitives.
3. Check shadcn/Base UI exports and existing wrappers.
4. Reuse the established primitive when it fits.
5. Create a module component only for feature-owned reuse or independent behavior.
6. Promote to shared UI only when it is genuinely app-wide.

Do not hand-roll a button, dialog, input, popover, select, badge, or panel because the
markup looks small. Small one-offs are how a design system becomes folklore.

## Core visual rule

The interface is a polished terminal emulator, not a generic SaaS dashboard:

- monospace, compact, text-forward UI;
- macOS terminal frame as the default shell;
- semantic restrained color;
- borders and low-opacity layers over heavy shadows;
- subtle motion with reduced-motion support;
- complete dark/light token remapping;
- full-bleed mobile and framed desktop behavior.

Use terminal tokens rather than ad hoc colors. Read the reference for the exact
palette and component recipes.

## File and component order

For TSX files, prefer this top-level order:

1. types;
2. constants;
3. pure helpers;
4. components.

Inside a component:

1. props, hooks, selectors, refs, state, and direct values;
2. derived values;
3. event handlers and local helpers;
4. effects/subscriptions;
5. JSX return.

Keep tightly coupled one-use helpers and small components in the consuming file.
Split when the file becomes hard to scan, the component is reused, or it has an
independent lifecycle/ownership.

## JSX rules

Write small, direct JSX:

- use ternaries for real either/or UI;
- use boolean-safe `&&` for show-or-nothing UI;
- use early returns for large loading, missing, or unauthorized states;
- avoid blank lines inside one prop group, expression tree, or child list;
- use semantic HTML when a component primitive adds no value;
- keep event handlers named `on{Name}{Event}`;
- bind `error.handle()`/`handleSync()` at the callback prop when possible.

```tsx
{messages.length > 0 && <MessageList messages={messages} />}
{isConnected ? <ConnectedStatus /> : <ReconnectStatus />}
```

Never use a number/string directly on the left of `&&`.

## Styling

Prefer, in order:

1. existing component variants/props;
2. semantic terminal or shadcn tokens;
3. static Tailwind utilities and state variants;
4. `cn()` for genuine computed composition;
5. custom CSS only when tokens/utilities cannot express the need.

Avoid hard-coded colors, arbitrary Tailwind values, new global selectors, CSS
modules, new icon libraries, and one-off dark/light branches. Third-party imperative
APIs may read raw token-equivalent colors when they cannot consume CSS variables.

Represent interactive state with semantic `aria-*` attributes first and `data-*`
attributes for visual state without an ARIA equivalent. Prefer static Tailwind
variants over runtime class ternaries when practical.

## Forms

Forms own UI validation and conversion, not business rules.

Prefer a module-local form seam with named pure operations when needed:

- default values;
- runtime schema;
- edit/entity-to-field hydration;
- field-data-to-request conversion.

Use existing controlled primitives and React Hook Form wrappers before writing raw
controls. Keep server/domain validation authoritative for business invariants.

## Tables and complex views

Keep rendering configuration separate from business behavior:

- map entities/contracts to a row/read model only when the view genuinely differs;
- keep column definitions and display formatting pure;
- pass user actions from the screen through typed callbacks/meta;
- keep mutation/navigation decisions out of cell renderers;
- derive filters/sort/pagination from canonical URL or feature state.

Do not create a parallel row model that merely renames identical fields.

## Hooks and effects

Use effects only to synchronize with something outside React. Do not use an effect to
derive state that can be computed during render or in a selector.

Keep each effect close to the lifecycle it owns and clean up subscriptions, timers,
media tracks, object URLs, and observers. Follow `client-state-management` for SSE,
SSR, optimistic state, and browser-device ownership.

Do not add `memo`, `useMemo`, or `useCallback` by reflex. React Compiler handles
ordinary memoization; use manual memoization only for a measured or integration-
specific reason.

## Accessibility

- Use semantic elements and form labels.
- Preserve visible terminal-green focus treatment.
- Give icon-only controls an accessible name.
- Mark active navigation with `aria-current="page"`.
- Do not rely on color alone for status.
- Preserve keyboard behavior, Escape handling, focus trapping, and reduced motion.
- Keep native option/select contrast readable in both themes.
- Add skip navigation for long content pages.

## Implementation workflow

1. Inspect the local screen and shared primitives.
2. Decide module-local versus shared ownership.
3. Read the terminal reference only to the depth the task needs.
4. Build structure and behavior before visual polish.
5. Verify mobile, desktop, dark, light, keyboard, focus, and reduced motion.
6. Run `bun run typecheck` and `bun run check`.

## What not to do

- Do not replace the terminal shell with generic dashboard styling.
- Do not create bespoke primitives that duplicate existing ones.
- Do not scatter business workflows through components.
- Do not duplicate navigable/store state locally.
- Do not hide inaccessible interactions behind icon/color only.
- Do not edit generated files such as `src/routeTree.gen.ts`.
- Do not copy a reference design's implementation architecture; translate its visual
  intent through this app's primitives and tokens.

## Related skills

- `app-architecture` — feature ownership and UI placement.
- `app-coding-styleguide` — non-visual TypeScript/JavaScript style.
- `client-state-management` — URL/Zustand/local state, SSR, and realtime lifecycles.
- `app-service-boundaries` — client HTTP/SSE/browser-service boundaries.
- `app-tests` — slice, contract, accessibility, and approved UI test conventions.
