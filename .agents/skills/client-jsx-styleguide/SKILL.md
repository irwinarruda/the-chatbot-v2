---
name: client-jsx-styleguide
description: Always load when creating or changing React views in src/client: routes, screens, components, dialogs, forms, layout, responsive behavior, accessibility, shadcn primitives, Tailwind classes, colors and the Favo theme. Also use when the request only says "make this look better", "add a button", "fix the mobile layout" or "change this color".
---

# Client JSX styleguide

## Authority

This skill owns views and visuals. Placement comes from `client-architecture`; state and data from `client-service-styleguide`. `src/client/shared/styles/tailwind.css` is the source of truth for tokens; `references/favo-theme.md` explains them.

## Look

- The interface is a terminal window in the Favo theme: Honey (dark, default) and Wax (light), switched by `data-theme` on `<html>`. Keep the window frame, mono labels and prompts; it is text-forward and restrained, not a SaaS dashboard.
- Colors come only from role tokens: `background`, `card`, `muted`, `popover`, `foreground`, `muted-foreground`, `faint`, `border`, `primary`, `brand`, `success`, `warning`, `info`, `hint`, `destructive`, `syntax-*`. Never a hex, `rgb()`, a Tailwind palette hue or a `dark:` branch; the default palette is switched off and the architecture test rejects color literals in TS.
- Each color has one job. Honey (`primary`, `brand`) is brand, the active item and the primary action. `success` is a good outcome, `warning` needs attention, `destructive` is a problem or a destructive action, `info` is a link. Most text stays `foreground` or `muted-foreground`.
- Tints are opacity on a signal (`bg-destructive/10`, `border-brand/25`), never a new color.
- Borders and low layers over heavy shadows; overlays and shadows use `scrim`.
- The logo keeps its shape; only its color follows the theme.

## Reuse before creating

1. Look at the nearest analogous screen.
2. Use `shared/components/ui` (shadcn on Base UI) and `shared/components/terminal` before writing markup. Never hand-roll a button, dialog, input, select, badge or panel.
3. A component used by one screen sits beside it in `screens/<Name>/`; one used by several screens of a module goes in the module's `components/`; promote to `shared/components` only when it is domain-free and used across modules.
4. Add a primitive with the shadcn CLI (`components.json` is configured), then make it use role tokens.

## Rules

- Select narrowly: `useApp((state) => state.todos)`. Never the whole store, never `useApp.getState()` in a component.
- Handlers are `on{Name}{Event}`: `onTodoCreate`, `onMessageSend`.
- Component order: selectors and state, derived values, handlers, effects, then `return`. No blank lines inside JSX.
- `{condition && <X />}` with a real boolean; a ternary only when both sides render.
- Never put Zustand actions in dependency arrays.
- Effects only synchronize with something outside React and always clean up.
- React Compiler memoizes; add `useMemo` or `useCallback` only for a measured reason. A component that reads mutable third-party state during render, such as a TanStack Virtual virtualizer, opts out with `"use no memo"`.
- Prefer component variants, then tokens, then static utilities, then `cn()`. No arbitrary values, CSS modules or new global selectors unless tokens cannot express it.
- Interactive state goes in `aria-*` first, `data-*` when there is no ARIA equivalent.

## Accessibility

- Semantic elements and labels; icon-only controls have an accessible name.
- Focus stays visible (`ring` is Favo accent). Never rely on color alone for a status.
- `aria-current="page"` on the active nav item; keyboard and Escape work; motion respects `prefers-reduced-motion`.
- Body text meets WCAG AA in both variants; `faint` is only for text a reader can ignore.

## Working references

- `src/client/shared/components/terminal/TerminalWindow.tsx`: the app frame.
- `src/client/modules/cash-flow/screens/BillsScreen/index.tsx`: signals, tints and dense data.
- `src/client/modules/chat/screens/ChatScreen/ChatMessage.tsx`: prose following the Favo markup rules.

## Checklist

1. It works at 390px and 1440px wide, in Honey and Wax.
2. `bun run check` and `bun run test:ui` pass; a view test covers new interaction or conditional rendering.
