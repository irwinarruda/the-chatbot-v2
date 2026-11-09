---
name: client-jsx-styleguide
description: Always load when creating or changing React views in src/client: routes, screens, components, dialogs, forms, layout, responsive behavior, accessibility, shadcn primitives, Tailwind classes, colors and the Barro and Favo themes. Also use when the request only says "make this look better", "add a button", "fix the mobile layout" or "change this color".
---

# Client JSX styleguide

## Authority

This skill owns views and visuals. Placement comes from `client-architecture`; state and data from `client-service-styleguide`. `src/client/shared/styles/tailwind.css` is the source of truth for tokens; `references/themes.md` explains them. How the app uses color and type comes from [irwin-ui](https://github.com/irwinarruda/irwin-ui), the owner's design system: `COLOR.md` (app screens and reading surfaces, written for any theme), `TYPE.md`, `BRAND.md` and `PATTERNS.md`. The colors themselves come from the two themes, barro-theme and favo-theme. When this skill and those disagree, follow them and fix this skill.

## Look

- The interface is a calm app shell, in the spirit of T3 Code, Codex, Claude Code and Linear, in one of two palettes: Barro (the owner's brand theme, cool slate with a brick accent, Slate and Kaolin; the default) or Favo (its calm gray pair, Smoke and Veil). `data-palette` on `<html>` picks the palette and `data-theme` its dark or light variant; both live in the prefs cookie, so the server renders the right one. The logo is the `>chatbot` wordmark, whose `o` is a brick speech bubble, and the favicon and app icon are its `>o` mark on a slate rounded tile, like the owner's own `ia` icon; they are the brand, so the palette never changes them. `AppShell` puts every signed-in page in one floating window of the same width on a `desk` background: on desktop its sticky title bar holds the brand, every module as a top-level tab and the preference controls; on phones and tablets the window fills the screen and the title bar opens the modules in a bottom sheet. There is no sidebar: the app has few modules, and the window is its identity. Signed-out pages get a centered card. It is text-forward and restrained, not a SaaS dashboard.
- Hierarchy comes from size and weight. Page titles and headings from 20px up are Chakra Petch (`font-display`), weight 600, sentence case, never 700 or capitals: `text-title` (26px) for page titles, `text-title-sm` (22px) for a card's title. Each is 2px above the sans size it replaced, because Chakra Petch looks smaller. Everything else is IBM Plex Sans, including small headings, navigation, the title bar and key numbers. Mono is for code, amounts in inputs and the locale chip, not for labels or headings.
- The app has two kinds of screens. App screens (lists, forms, dashboards, the title bar) follow the color rules below. Reading surfaces, text someone reads top to bottom, are the chat replies, the note viewer and editor and the privacy page: their container carries `reading-surface`, which colors text by kind, the way code is colored. Body text is the theme's `fg-reading`, a step below `foreground`, so bold, in `foreground` at 700, stands out; italics are `syntax-param`, links `syntax-function`, h1 and h2 `syntax-keyword` in Chakra Petch, h3 and h4 `syntax-type`, and inline code `foreground`. Never put `reading-surface` around chrome, buttons or forms, and never color text by kind outside it.
- Lists are one bordered `rounded-xl` card with divider rows: title first, one muted meta line, actions on the right. Page headers are left-aligned with the primary action on the right, and screens hand `TerminalPageHeader` their actions as data (`primaryAction`, `secondaryActions`) instead of buttons: below `md` the header stays one row, the primary shrinks to its icon (a non-create action keeps its label with `shouldKeepLabel`) and secondary actions fold into a More menu under their full names. Never put a row of buttons under the title on phones; touch buttons are 44px tall and three of them overflow a 393px screen. The key number of a data screen (net balance, amount left to pay) leads in large type.
- Empty and no-result states use `ListEmptyState` with a next action; destructive confirmations use `ConfirmDialog` and name the item, never `window.confirm`.
- Colors come only from role tokens: `background`, `desk`, `card`, `muted`, `popover`, `foreground`, `muted-foreground`, `faint`, `border`, `input`, `primary`, `brand`, `brand-text`, `brand-soft`, `success`, `warning`, `info`, `hint`, `destructive`, the `-soft` and `-line` of each status, `syntax-*`. Never a hex, `rgb()`, a Tailwind palette hue or a `dark:` branch; the default palette is switched off and the architecture test rejects color literals in TS.
- Each color has one job. The palette accent (`primary`, `brand`, `brand-text`, `brand-soft`: brick in Barro, honey in Favo) is brand, the active item and the primary action: `primary` fills buttons, with `primary-foreground` on them (white on Barro's brick, dark on Favo's honey), `brand` outlines the active item and draws focus, `brand-text` colors brand text and icons, and `brand-soft` sits behind them. Never write brand text as `text-primary`; the brick is too dark and Veil's honey too bright to read as text. `success` is a good outcome, `warning` needs attention, `destructive` is a problem, `info` is a link on an app screen. Errors have their own red, never a code color. Barro's red is a plain red, close to its clay, because that is what reads as an error, and Favo's warning is its honey, so a status also says what it is with an icon or a word. Most text stays `foreground` or `muted-foreground`.
- A badge, a chip or a banner is soft: `bg-<status>-soft` behind, `text-<status>` on it and `border-<status>-line` around, with `destructive` standing for danger. `Badge` has a variant for each status and `Alert` has `destructive`; the brand's is `bg-brand-soft` under `text-brand-text`, as on the current tab. Never put text or a status icon on an opacity tint of a status or brand color (`bg-success/10`, `bg-brand/12`): a tint lands between two steps of the theme, where nothing is checked and text falls to 4.2:1. Opacity is for what carries no text: borders, rings and shadows (`border-brand/25`, `ring-destructive/30`).
- A destructive button is quiet: `Button`'s `destructive` variant is `destructive-soft` behind `text-destructive`, a secondary button in red. It is never a solid fill and never louder than the primary button beside it, so in a dialog the eye goes to Save, not to Delete.
- Inputs are recessed. An input, a textarea or a select is a well in the dialog or card that holds it: filled with `bg-input/30`, a step darker than it in the light variants and a step lighter in the dark ones, inside the same quiet border as a card (`border-input` reads `border`). Never fill an input with `background`: that makes it lighter than its dialog in light and darker in dark, the reverse of every other screen, and it reads as wrong at once (irwin-ui `COLOR.md`, "Depth"). A checkbox keeps its `muted-foreground` border.
- Borders and low layers over heavy shadows; overlays and shadows use `scrim`.
- Only the logo's letters follow the theme, through its two files: `logo-dark.svg` on dark and `logo-light.svg` on light. Every brand asset lives in `public/brand/`, whose `README.md` says where each file is used. Never recolor or redraw them by hand.

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
- Focus stays visible (`ring` is the palette accent). Never rely on color alone for a status.
- `aria-current="page"` on the active nav item; keyboard and Escape work; motion respects `prefers-reduced-motion`.
- Body text meets WCAG AA in both variants; `faint` is only for text a reader can ignore.

## Working references

- `src/client/shared/components/terminal/AppShell.tsx`: the app frame.
- `src/client/modules/cash-flow/screens/BillsScreen/index.tsx`: signals and dense data.
- `src/client/modules/cash-flow/screens/CashFlowScreen/CashFlowTransactionRow.tsx`: a status badge and a soft icon chip.
- `src/client/modules/todos/components/TodoDetailDialog.tsx`: a form, with a destructive button beside the primary one.
- `src/client/modules/chat/screens/ChatScreen/ChatMessage.tsx`: a reading surface (the bot reply inside `reading-surface`, the user's bubble on app rules) and per-message actions.

## Checklist

1. It works at 390px and 1440px wide, in both palettes, dark and light. Check phones with touch emulation (Playwright `hasTouch` and `isMobile`): touch makes controls 44px tall, so a desktop-pointer screenshot hides overflow.
2. `bun run check` and `bun run test:ui` pass; a view test covers new interaction or conditional rendering.
