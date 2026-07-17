# Terminal Design System Reference

Read this reference when a UI task needs exact terminal tokens, page shells,
component patterns, prose rules, animations, or visual semantics.

## Contents

- Purpose and visual thesis
- Tech, CSS, and theme architecture
- Design tokens
- Layout and terminal chrome
- Typography
- Reusable components and shadcn primitives
- Page patterns
- Prose, badges, cards, and semantic colors
- Animation, accessibility, and iconography
- Implementation guidance and prohibited patterns

## Purpose and visual thesis

Use this skill to make every UI change look native to **The Chatbot**. The app is a personal terminal-flavored assistant with a macOS terminal window frame, monochrome/monospace structure, green command prompts, subdued surfaces, and terminal color semantics for status and meaning.

The source of truth is this application's implementation and the tokens in `src/shared/client/styles/tailwind.css`. When there is tension between generic shadcn defaults and this app's aesthetic, adapt shadcn primitives into the terminal palette instead of introducing a separate visual language.

The whole interface should feel like a polished terminal emulator, not a generic SaaS dashboard:

- A macOS-style terminal window is the default page shell.
- Content is monospaced by default, compact, command-like, and text-forward.
- Color is semantic and restrained: green for primary/action/success, amber for pending/warning/dates, red for destructive/error/recording, cyan/blue for links and secondary interactive affordances, muted gray-blue for metadata.
- Surfaces are layered like a terminal: page background → terminal window → chrome/title bar → panels/cards/inputs.
- Borders and low-opacity fills create structure; avoid heavy shadows except the terminal window and modal overlay.
- Animations are subtle terminal cues: blinking cursor, pulsing connection dot, fade-in-up. Respect reduced motion.

## Tech and CSS architecture

- Styling uses **Tailwind CSS v4**, CSS-first config in `src/shared/client/styles/tailwind.css`.
- The project imports Tailwind, `tw-animate-css`, and `shadcn/tailwind.css` from that one CSS file.
- Custom design tokens live in `@theme`; light mode overrides token values with `[data-theme="light"]`.
- There is no Tailwind config file; do not add one for normal app styling.
- Prefer Tailwind utility classes in components.
- Keep bespoke global CSS limited to:
  - design tokens,
  - base theme wiring,
  - custom utilities,
  - terminal prose selectors,
  - theme-specific logo glow and selection/focus rules.
- Do not introduce CSS modules or component-scoped styles unless the user explicitly asks for a new architecture.
- shadcn/ui primitives are allowed, but theme them with terminal tokens and compact sizes.

## Theme system

Official app behavior:

- Theme is attribute-driven: `<html data-theme="dark" | "light">`.
- Dark is the default visual baseline.
- Theme preference is part of `Prefs`, read through request-scoped route context during SSR, hydrated into the per-application client store, and persisted by the owning client service.
- The root document sets `<html lang={prefs.locale} data-theme={prefs.theme}>`.
- `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));` supports Tailwind dark variants.
- Theme toggle appears as a chrome button:
  - light mode shows `☀`, title `dark`;
  - dark mode shows `☽`, title `light`.
- Locale toggle appears beside it as `PT` or `EN`.

When adding themed UI:

- Use `term-*` tokens, not hard-coded ad hoc colors.
- If a hard-coded color is necessary for a third-party library (for example WaveSurfer), map it directly from the token values:
  - dark green: `#50dfaa`, rgba wave `rgba(80, 223, 170, 0.35)`;
  - light green: `#0b7d4e`, rgba wave `rgba(11, 125, 78, 0.35)`.
- Preserve light mode as a complete token remap, not a parallel set of component class overrides.

## Design tokens

### Fonts

- `--font-mono`: `"JetBrains Mono", ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace`.
- `--font-sans`: `"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Local font files: `/fonts/jetbrains-mono-latin.woff2`, `/fonts/ibm-plex-sans-latin.woff2`, `/fonts/ibm-plex-sans-latin-ext.woff2`.
- `@font-face` uses JetBrains Mono weights `300 700` and IBM Plex Sans weights `100 700`, both with `font-display: block` and Latin (plus Latin-ext for Plex) unicode ranges.
- The app preloads both primary fonts from the root document.
- Use monospace for UI, nav, chrome, buttons, inputs, chat, todo, metadata, and headings.
- Use IBM Plex Sans for body copy, descriptions, and longer `.terminal-prose` paragraphs/list items.

### Surface colors

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `term-bg` | `#0c1018` | `#eae8e4` | page background, deepest terminal background, code/input/panel interior |
| `term-window` | `#131a23` | `#faf8f5` | main terminal content panel, modal body |
| `term-chrome` | `#1c2330` | `#e6e3de` | title bar, composer bar, filter panels, hover surfaces |
| `term-border` | `#282f3c` | `#d1cdc6` | borders, dividers, separators, input outlines |

### Accent colors

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `term-green` | `#50dfaa` | `#0b7d4e` | primary accent, headings, prompts, active nav, send/primary action, success, focus |
| `term-green-dim` | `#3ab888` | `#0a7248` | dimmed green variant |
| `term-green-dot` | `#27c93f` | `#22c55e` | macOS maximize dot, connection status dot |
| `term-amber` | `#ffb627` | `#a06000` | dates, pending, warnings, microphone/audio controls, emphasis, inline code |
| `term-amber-strong` | `#ffb627` | `#8a5200` | stronger amber badge/tag text |
| `term-red` | `#ff5f56` | `#ef4444` | close dot, errors, destructive actions, recording state, removals |
| `term-yellow` | `#ffbd2e` | `#daa520` | macOS minimize dot |
| `term-blue` | `#58a6ff` | `#2563eb` | inactive nav links, secondary links, bot quick reply buttons |
| `term-cyan` | `#7ee8fa` | `#067a96` | hover links, user labels, quote accents, secondary highlights |
| `term-cyan-strong` | `#7ee8fa` | `#0b6b85` | tags/badges |
| `term-magenta` | `#d2a8ff` | `#7c4ddb` | exploratory/category badges |
| `term-magenta-strong` | `#d2a8ff` | `#6f42c1` | stronger magenta badge text |

### Text colors

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `term-text` | `#b0bec9` | `#4d5566` | body text, chat text, descriptions |
| `term-muted` | `#8494a7` | `#5c6676` | metadata, timestamps, labels, title bar text, placeholders |
| `term-bright` | `#f8fafc` | `#1c2028` | headings, strong text, important titles |

### shadcn token bridge

The app maps shadcn tokens to terminal tokens in `:root`:

- `background` → `term-bg`
- `foreground` → `term-text`
- `card` / `popover` / `sidebar` → `term-window`
- `primary` / `ring` / `chart-1` → `term-green`
- `secondary` / `muted` / `accent` → `term-chrome`
- `destructive` → `term-red`
- `border` / `input` → `term-border`
- charts: green, cyan, blue, amber, magenta.

Use the generic shadcn tokens in base primitives, but use explicit `term-*` classes when composing app-specific UI.

### Selection, focus, scrollbars

- Dark selection: `rgba(80, 223, 170, 0.15)`, text `term-green`.
- Light selection: `rgba(18, 165, 102, 0.18)`, text `term-green`.
- Focus visible globally: `outline: 2px solid term-green`, `outline-offset: 2px`, `border-radius: 2px`.
- Inputs often add glow: `0 0 0 3px rgba(80,223,170,0.12)`.
- Scrollbars: thin; thumb `term-muted`, track transparent.
- Body uses antialiasing and `isolation: isolate`.

### Opacity convention

Use opacity suffixes for terminal layering:

- `/5`, `/8`: very subtle tint, especially badge/code backgrounds.
- `/10`, `/12`, `/15`: hover/active fills, focus glows, alerts.
- `/20`, `/25`, `/30`: borders, status rings, diff/active state.
- `/40`, `/45`, `/50`, `/60`: stronger borders and metadata emphasis.
- `/70`, `/80`: panel backgrounds and gradients.

## Layout system

### Terminal window shell

Use `TerminalWindow` for most pages instead of rebuilding the frame.

Default outer shell:

```tsx
<main className="flex min-h-dvh items-start justify-center bg-term-bg p-0 sm:p-6 md:p-10">
```

Frame:

- `flex w-full flex-col`
- default max width: `max-w-xl`
- wide pages: `max-w-4xl`
- chat uses full viewport height with `h-dvh sm:h-[calc(100dvh-3rem)] md:h-[calc(100dvh-5rem)]`
- todo uses minimum viewport height with matching responsive calc classes.

Chrome/title bar:

- `flex items-center gap-3 border-b-0 bg-term-chrome px-3 py-2 sm:rounded-t-xl sm:border sm:border-term-border sm:px-4`
- Mobile is full-bleed with no rounded corners and no visible outer border.
- Desktop adds rounded top corners and border.

Content panel:

- default: `flex-1 bg-term-window p-6 sm:rounded-b-xl sm:border sm:border-term-border sm:border-t-0 sm:p-9 sm:shadow-2xl sm:shadow-black/10 md:p-10`
- Default content padding is `p-6 sm:p-9 md:p-10`; keep this unless a page has a specific dense layout such as chat.
- Chat overrides content padding to `p-0` and controls its own scroll/composer layout.
- Optional bottom decoration: `mx-4 hidden h-2 rounded-b-xl bg-black/20 blur-sm sm:block`.

### Responsive behavior

- Breakpoints are standard Tailwind: mobile default, `sm` 640px, `md` 768px.
- Mobile: full-bleed window, no rounded frame, no outer padding.
- `sm`: outer padding, terminal border, rounded corners, shadow/decoration appear.
- `md`: larger padding and multi-column layouts.
- Keep primary content usable at full mobile width without cramped side gutters.
- Prefer grid templates like `md:grid-cols-[minmax(0,1fr)_auto]` or fixed terminal-ish columns only at `md` and up.

## Terminal chrome patterns

### macOS dots

Three left chrome buttons, each `h-3 w-3 rounded-full transition-opacity hover:opacity-80`:

- Close: `bg-term-red`
- Minimize: `bg-term-yellow`
- Resize/maximize: `bg-term-green-dot`

In this app, all three navigate home. Preserve the playful terminal-window metaphor unless changing behavior is part of the requested feature.

### Title

- Centered with `mx-auto min-w-0 select-none truncate px-2 text-term-muted text-xs tracking-wide`.
- Use concise command/window titles such as page names or chat user names.

### Chrome controls

Use `TerminalChromeButton`:

```tsx
"min-h-6 rounded border border-transparent px-1.5 py-0.5 text-[0.6875rem] text-term-muted leading-none hover:border-term-border hover:bg-term-bg hover:text-term-bright"
```

Controls are compact and textual/iconic. Keep them in the title bar, not as large toolbar buttons.

### Navigation

TerminalWindow navigation:

- Container: `mb-7 flex flex-wrap items-center gap-x-6 gap-y-1 text-base`
- Active link: `font-medium text-term-green transition-colors duration-200 hover:text-term-cyan`
- Inactive link: `text-term-blue transition-colors duration-200 hover:text-term-cyan`
- Active path options currently: `/`, `/privacy`, `/chat`, `/todo`.

## Typography and text hierarchy

### General UI

- Headings: monospace, green, bold/semibold, tight tracking.
- Metadata: small, muted, often uppercase with wider tracking.
- Body descriptions: small (`text-sm`) and relaxed line height.
- Keep text compact; the app is intentionally terminal dense.

### Official app sizes

- Chrome title/control text: `text-xs` / `text-[0.6875rem]`.
- Custom `text-2xs`: `0.625rem`, line-height `0.875rem`.
- Page header: `text-2xl sm:text-3xl`, bold, `tracking-tight`.
- Page subtitle: `text-sm text-term-muted`.
- Panel text: `text-sm leading-relaxed`.
- Chat message text: `text-sm leading-relaxed`.
- Chat labels/timestamps: `text-2xs`, uppercase/tracking for labels.
- Todo row names: `text-sm font-medium`.
- Button default: `text-sm`; small buttons `text-xs` or `text-[0.8rem]`.

### Prose sizes

The official `.terminal-prose` scale in this app is:

- `h1`: `1.5rem`
- `h2`: `1.125rem`
- `h3`: `1rem`
- `p` and `li`: `1.125rem`, line-height `1.75`
- blockquote mono: `0.9375rem`

For especially long-form article pages, the design system may scale prose up while preserving the same hierarchy and colors: paragraphs/list items around `1.25rem`, `h2` around `1.5rem`, and `h3` around `1.25rem`.

## Core reusable components

### `TerminalWindow`

Use for framed pages. Props shape the layout:

- `wide` for `max-w-4xl`; otherwise `max-w-xl`.
- `showNavigation` defaults to `dictionary !== undefined`.
- `showShadow` controls the small bottom blurred shadow.
- `chromeControls` replaces locale/theme controls for pages like chat.
- `mainClassName`, `frameClassName`, `windowClassName` are preferred extension points.

Do not duplicate its chrome/nav/frame markup in new pages unless building a special full-screen surface.

### `TerminalPageHeader`

Default page header:

- `header`: `mb-6 text-center`
- optional logo (`ThemeLogo`) unless `withLogo={false}`
- `h1`: `m-0 mb-1.5 font-bold text-2xl text-term-green tracking-tight sm:text-3xl`
- subtitle: `m-0 text-sm text-term-muted`
- optional badge below.

Use `withLogo={false}` on dense/internal pages like chat login, not registered, and todo.

### `ThemeLogo`

- Uses `/logo.svg` in dark mode and `/logo-light.svg` in light mode.
- Size: `h-12 w-12 sm:h-16 sm:w-16`.
- Centered with `mx-auto mb-4 block`.
- `terminal-logo-glow` applies green drop shadow:
  - dark: `drop-shadow(0 0 12px rgba(80, 223, 170, 0.25))`
  - light: `drop-shadow(0 0 12px rgba(11, 125, 78, 0.2))`
- Logo SVG fill colors are dark `#50DEA9` and light `#0B7D4E`.

### `TerminalPanel`

- Card wrapper: `mb-6 border border-term-border bg-term-bg/70 shadow-none`
- Content: `space-y-3 p-5`
- Use for explanatory panels, login copy, thank-you/not-found content.

### `TerminalPanelText`

- `m-0 text-sm text-term-text leading-relaxed`
- Strong text inside: semibold and `term-bright`.

### `TerminalFooter` and `TerminalPrompt`

- Footer: `text-[0.8125rem] text-term-muted` with `Separator` `mb-5 bg-term-border`.
- Prompt: green `$`, text, blinking terminal cursor.
- Use footer prompts to end small informational pages with a terminal command-line feel.

### `TerminalStatusBadge`

- Success/status badge: `mt-4 h-auto gap-2 rounded-md border border-term-green/25 bg-term-green/10 px-3.5 py-1.5 font-medium text-[0.8125rem] text-term-green hover:bg-term-green/10`
- Includes small green dot `h-1.5 w-1.5 rounded-full bg-term-green`.

## shadcn/base UI primitives

### Buttons

Base `Button` uses Base UI + CVA:

- Base: `inline-flex`, compact, `rounded`, `border border-transparent`, `font-medium text-sm`, `transition-all`.
- Focus: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`.
- Disabled: pointer-events none and opacity 50.
- Default variant: `bg-primary text-primary-foreground`.
- Outline: `border-border bg-background hover:bg-muted hover:text-foreground`.
- Ghost: hover muted.
- Destructive: `bg-destructive/10 text-destructive hover:bg-destructive/20`.
- Link: primary underline on hover.
- Sizes: default `h-8`, xs `h-6`, sm `h-7`, lg `h-9`, icon `size-8`, icon-xs `size-6`, icon-sm `size-7`, icon-lg `size-9`.

When composing app-specific buttons:

- Keep buttons compact and rectangular/rounded, not pill-shaped unless the UI is a floating circular control.
- Pair icons with small text using Lucide icons sized around `size-3` to `size-4`.
- Use explicit terminal hover states: green for primary/send, amber for microphone/pending, red for destructive, cyan/blue for secondary choices.

### Inputs

Base `Input`:

- `h-8 w-full min-w-0 rounded border border-input bg-transparent px-2.5 py-1 text-base md:text-sm`
- Placeholder: `text-muted-foreground`.
- Focus shadow: `0 0 0 3px rgba(80,223,170,0.12)`.
- Invalid shadow red: `rgba(255,95,86,0.12)`.

Use icons inside relative wrappers with absolute `left-2.5` and input padding `pl-8`.

### Textarea

Base `Textarea`:

- `field-sizing-content flex min-h-16 w-full rounded border border-input bg-transparent px-2.5 py-2 text-base md:text-sm`
- Focus ring uses terminal green ring.
- Chat composer overrides with a transparent, borderless monospace textarea inside a framed command input.

### Native select

Base `NativeSelect`:

- Wrapper: `relative w-fit`, disabled opacity.
- Select: `h-8 w-full appearance-none rounded border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm`.
- Icon: chevron at `right-2.5`, `size-4`, muted.
- Small size: `h-7 rounded py-0.5`.
- Options use system canvas colors for native dropdown readability.

### Cards, badges, alerts, dialogs

- Cards: `rounded-lg border border-border bg-card py-4 text-card-foreground text-sm`, compact with optional `size="sm"`.
- Badges: `h-5 rounded-md border px-2 py-0.5 font-medium text-xs`.
- Alerts: grid, rounded, border, small text. Destructive text maps to red. For page errors, app often uses `border-term-red/30 bg-term-red/10` and text `term-red`.
- Dialog overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm`.
- Dialog panel: `max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-auto rounded-lg border border-term-border bg-term-window shadow-2xl shadow-black/40`.
- Dialog header: sticky, `border-b bg-term-chrome px-4 py-3`, title `font-semibold text-sm text-term-bright`.

## Page patterns

### Welcome page

- `TerminalWindow` max width default, nav enabled, logo visible.
- Header + compact description paragraph.
- Feature list uses terminal bullets:
  - `relative py-2.5 pl-6`
  - `before:content-['>']`, green, semibold, monospace.
- Feature title: `font-medium text-[0.9375rem] text-term-bright`.
- Description: `text-sm text-term-text leading-relaxed`.
- Footer sticks to bottom on stretched mobile with `mt-auto pt-6 sm:mt-0`.

### Informational/auth pages

- Login, not-registered, thank-you, already-signed-in, not-found use TerminalWindow + TerminalPageHeader + TerminalPanel + TerminalFooter.
- For Google login, the one intentional visual exception is the Google button:
  - `h-11 w-full rounded-md border border-term-border bg-white px-4 font-semibold text-slate-900 text-sm hover:bg-slate-100`.
- Keep OAuth/provider buttons faithful to provider expectations while still framed by terminal panels.

### Privacy/markdown page

- Wide TerminalWindow, nav active `/privacy`.
- Render markdown HTML inside `.terminal-prose`.
- Footer copyright: `mt-8 border-term-border border-t pt-5 text-[0.8125rem] text-term-muted`.

### Chat page

Chat is a full terminal application inside the terminal frame:

- Wide window, navigation hidden, shadow hidden.
- Frame height fills viewport: `h-dvh sm:h-[calc(100dvh-3rem)] md:h-[calc(100dvh-5rem)]`.
- Content panel: `relative flex min-h-0 flex-1 flex-col overflow-hidden p-0`.
- Bootstrapping state is a full-screen terminal window with centered cursor and muted loading text.
- Chrome controls include:
  - connection dot `h-1.5 w-1.5 rounded-full`, connected `bg-term-green-dot motion-safe:animate-glow-pulse`, disconnected `bg-term-muted`;
  - locale button;
  - todo icon button;
  - theme button;
  - logout ghost button styled red.
- Error alert is a top strip: `rounded-none border-term-red/25 border-x-0 border-t-0 border-b bg-term-red/12 px-4 py-2`.
- Messages scroll in `relative flex-1 overflow-y-auto p-4 sm:p-5`.
- Empty state centers `$`, message, and cursor.
- Scroll-to-bottom button is circular: `h-8 w-8 rounded-full border border-term-border bg-term-chrome p-0 shadow-lg hover:bg-term-green/10 hover:text-term-green`.

### Chat messages

- Message container max width:
  - audio: `max-w-[85%] sm:max-w-80`
  - text: `max-w-[85%] sm:max-w-[80%]`
- User messages align right (`ml-auto`), bot left (`mr-auto`).
- Label: `mb-0.5 px-0.5 font-semibold text-2xs uppercase tracking-wider`
  - user label: right, `text-term-cyan`
  - bot label: left, `text-term-green`
- Bubble: `rounded-lg border px-3.5 py-2.5`
  - user: `border-term-green/20 bg-term-green/8`
  - bot: `border-term-border bg-term-bg`
- Timestamp: `mt-0.5 px-0.5 text-2xs text-term-muted`, aligned with message.
- Message text: `wrap-break-word flex flex-col gap-2 text-sm text-term-text leading-relaxed`.
- Bullet lists use green `>` markers.
- Ordered lists use cyan-ish markers: `marker:text-term-cyan/80`.
- Quotes: rounded-right, `border-l-2 border-term-cyan/45 bg-term-cyan/8 px-3 py-2`, subtle inset highlight.
- Bold: `text-term-bright`; italic: `text-term-text/95`; strikethrough: muted with red decoration.
- Inline code: `rounded border border-term-border bg-term-chrome px-1.5 py-0.5 font-mono text-[0.8125em] text-term-amber`.
- Monospace WhatsApp formatting: green code pill with `border-term-green/20 bg-term-green/8` and subtle glow.
- Bot interactive reply buttons: outline, `border-term-blue/30 bg-term-blue/8 text-term-blue hover:border-term-cyan/40 hover:bg-term-cyan/10 hover:text-term-cyan`.

### Chat composer

- Composer container: `shrink-0 border-term-border border-t bg-linear-to-b from-term-chrome to-term-chrome/80 px-4 py-3`.
- Hint row: tiny muted text, opacity 75 normally, 100 on hover/focus.
- Keyboard hint pill: `rounded border border-term-border bg-term-bg px-1.5 py-px text-[0.625rem] text-term-text tracking-wider`.
- Audio input select is compact/transparent and amber on hover/focus.
- Command input frame:
  - `flex items-start gap-0 rounded-lg border border-term-border bg-term-bg pr-1.5 pl-3.5 transition-all duration-200`
  - focus: `border-term-green` and green glow.
  - prompt glyph: green `>` with text shadow `0 0 8px rgba(80,223,170,0.35)`.
- Textarea: max height 10rem, transparent, borderless, monospace, `caret-term-green`, placeholder muted.
- Mic button: muted → amber hover.
- Send button: muted/enabled green → green hover.
- Recording state:
  - red blinking dot `motion-safe:animate-blink`;
  - red recording label;
  - cancel outline button muted → red hover;
  - send recording destructive button red border/fill.

### Audio waveform

- WaveSurfer height: `32`, `barWidth: 2`, `barGap: 1`, `barRadius: 2`, normalized.
- Wrapper: `flex min-w-55 max-w-70 items-center gap-2`.
- Play button: `h-7.5 w-7.5 rounded-md border border-term-border bg-term-bg text-term-green hover:border-term-green/40 hover:bg-term-green/10`.
- Time label: `text-2xs text-term-muted tracking-wide`.
- Use green progress/cursor colors per theme.

### Todo page

Todo is terminal utility UI, denser than marketing/info pages:

- Wide TerminalWindow, active `/todo`, no logo in header.
- Header badge row: centered tiny status/action chips.
- Pending count: `border-term-amber/40 text-term-amber`.
- Completed count: `border-term-green/40 text-term-green`.
- Chat link: `border-term-blue/40 text-term-blue hover:border-term-cyan hover:text-term-cyan`.
- Error alert: `mb-4 border-term-red/30 bg-term-red/10`, description red.
- Filters section: `mb-4 border border-term-border bg-term-chrome/50 p-3`.
- Composer section appears below filters.
- List label: `flex items-center gap-2 text-2xs text-term-muted uppercase`, icon green.
- Loading box: `border border-term-border bg-term-bg/40 p-6 text-center text-sm text-term-muted` with cursor.
- Empty box: dashed border, `bg-term-bg/40 p-8 text-center text-sm text-term-muted`.

### Todo filters and composer

- Filters use compact grid layouts and terminal inputs.
- Search/date icons are absolute, muted, `size-4`, with input `pl-8`.
- Debounced changes are invisible to design; do not add loading spinners unless necessary.
- Todo composer:
  - `border border-term-border bg-term-bg/60 p-3`
  - header prompt: `text-2xs text-term-green uppercase`, literal `>`.
  - main grid: `md:grid-cols-[minmax(0,1fr)_10rem_9rem]`.
  - textarea: `mt-2 min-h-20`.
  - actions right-aligned with outline cancel and default create.

### Todo rows

- Row shell:
  - `relative grid w-full grid-cols-[auto_1fr] gap-3 border-term-border border-l-2`
  - `bg-term-bg/45 px-3 py-3 text-left transition-colors hover:border-term-green hover:bg-term-chrome/80`
- Full-row absolute button handles open; status button remains pointer-enabled above it.
- Prompt mark: `>_` in `font-bold text-term-green text-xs`.
- Title: `text-sm font-medium`, bright if pending, muted/line-through if completed.
- Status mini-button:
  - border transparent, uppercase `text-2xs`, hover border current.
  - completed green, pending amber.
- Metadata line: `text-2xs text-term-muted`; due date amber if present, muted if absent.

### Todo detail dialog

- Uses the shared `Dialog` terminal modal.
- Body: `space-y-4 p-4`.
- Top row: name input + status select at `md:grid-cols-[1fr_auto]`.
- Description textarea min height `min-h-28`.
- Due/status row: calendar amber, status icon/text muted.
- Source audio section:
  - `border border-term-border bg-term-bg/55 p-3`
  - label: `mb-2 flex items-center gap-2 text-2xs text-term-cyan uppercase`
  - transcript label muted uppercase, transcript `whitespace-pre-wrap text-sm text-term-text`.
- Footer actions: border top, delete left, cancel/save right.

## Prose / markdown styling

Use `.terminal-prose` for trusted rendered markdown/HTML.

Current selectors:

- Root text: `term-text`.
- Last child has no bottom margin.
- `h1`: mono, green, `1.5rem`, bold, tight, margin bottom `0.375rem`.
- `h2`: mono, green, `1.125rem`, semibold, bottom border `term-border`, `margin: 2rem 0 0.75rem`, `padding-bottom: 0.5rem`, letter spacing `-0.01em`.
- `h3`: mono, cyan, `1rem`, medium, `margin: 1.5rem 0 0.5rem`.
- `p`: IBM Plex Sans, `1.125rem`, line-height `1.75`, `margin-bottom: 1rem`, text color `term-text`.
- `strong`: `term-bright`, weight 600.
- `em`: `term-amber`, italic.
- `ul`/`ol`: no native list style, `padding-left: 1.5rem`, `margin-bottom: 1rem`.
- `li`: relative, IBM Plex Sans, `1.125rem`, line-height `1.75`, `padding-left: 1.25rem`, `margin-bottom: 0.625rem`.
- `ul li::before`: content `>`, green, semibold, monospace.
- `ol li::before`: green monospace counter.
- `a`: blue, underlined, underline offset 2px, hover cyan.
- `blockquote`: `margin: 1.25em 0`, `padding: 1rem 1.25rem`, rounded, `bg-term-chrome`, green left border 2px, mono italic `0.9375rem`.
- `blockquote p`: mono `0.9375rem`, line-height 1.6, no margin.
- Inline `code`: amber, amber low-opacity background, `padding: 0.15em 0.4em`, radius `0.25rem`, size `0.85em`, mono. Light background uses `rgba(196, 118, 0, 0.1)`.
- `hr`: 1px `term-border`, `margin: 2em 0`.

Official code-block/syntax highlighting settings:

- `rehype-pretty-code` with Shiki.
- Dark theme `github-dark`; light theme `github-light`.
- `keepBackground: false`.
- Code block background from design system (`term-bg`; light variant `#ece8e1`).
- Border `1px solid term-border`, radius `0.5rem`.
- Highlighted line: dark `rgba(80, 223, 170, 0.08)`, light `rgba(18, 165, 102, 0.12)`.
- Line numbers: muted, width `2rem`, right margin `1rem`.
- Theme switching via `--shiki-dark` / `--shiki-light` custom properties.

When adding markdown code blocks, use these exact settings.

## Badge, card, status, and semantic color patterns

### Generic badge/tag categories

All share `text-sm px-2 py-0.5 rounded border`:

- Primary: `text-term-cyan-strong bg-term-cyan/8 border-term-cyan/15`
- Exploring: `text-term-magenta-strong bg-term-magenta/8 border-term-magenta/15`
- Tools: `text-term-amber-strong bg-term-amber/8 border-term-amber/15`

### Project/card pattern

Use for two-column card grids:

```txt
group rounded-lg border border-term-border/60 bg-term-chrome/30 p-3
transition-all duration-300
hover:border-term-green/30 hover:bg-term-chrome/50
```

Grid: `grid gap-3 sm:grid-cols-2`.

### Post/list entry pattern

Useful for article/list-style pages:

- 2px left accent line via border or pseudo-element.
- Default line: `term-border`; hover line: `term-green` with 0.3s transition.
- Card: `rounded-r-lg pl-5 py-3.5 hover:bg-term-chrome/50`.
- Title: `term-bright` → hover `term-green`.
- Date: `term-amber font-medium`.
- Description: `term-text`.
- Tags: `term-cyan-strong` prefixed with `#`.
- Draft badge: dashed amber border, `bg-term-amber/8`, small mono amber text.

Todo rows follow this same left-accent list-entry idea.

### Callout and image patterns

Callout:

```txt
my-6 rounded-lg border border-term-border bg-term-bg/70
px-4 py-3 text-base text-term-text
```

Image container:

```txt
rounded-lg overflow-hidden border-2 border-term-border
ring-1 ring-term-green/20 bg-term-bg
```

### Score/status colors

- Good / success / >= 7.5: `term-green`.
- Warning / pending / >= 6.5: `term-amber`.
- Bad / destructive / < 6.5: `term-red`.

### Diff colors

- Removal: `bg-term-red/20 text-term-red`.
- Addition: `bg-term-green/20 text-term-green`.

## Animation and motion

Defined in `@theme`:

- `blink`: opacity `1 → 0 → 1`, `1.1s step-end infinite`.
- `glow-pulse`: opacity `1 → 0.85 → 1`, `4s ease-in-out infinite`.
- `fade-in-up`: opacity 0 + translateY(8px) to visible, `0.5s ease-out both`.

Custom utilities:

- `terminal-cursor`: inline block, `0.5rem × 0.95rem`, green background, `vertical-align: text-bottom`, `margin-left: 2px`, blinking.
- `fade-in`, `fade-in-delay-1` through `fade-in-delay-6`: delay increments of `0.1s`.

Motion guidance:

- Use `motion-safe:` for animated UI when possible.
- Reduced motion media query disables `.terminal-cursor`, `[class*="fade-in"]`, and `[class*="animate-"]` with an important override.
- Keep animations ornamental and low-intensity; do not animate layout-heavy interactions unnecessarily.

## Accessibility

Preserve these accessibility conventions:

- Use semantic elements: `main`, `nav`, `header`, `section`, `button`, form controls.
- Mark active nav with `aria-current="page"`.
- Chrome dot buttons have `title` and `aria-label`.
- Icon-only buttons need `aria-label` or `title`.
- Dialog uses `role="dialog"`, `aria-modal="true"`, Escape-to-close, click-away close, and visible close button.
- External links should include sr-only "opens in new tab" text if added.
- Keep focus visible: do not remove outlines/rings without replacing them with terminal-green focus treatment.
- Do not rely on color alone for status; combine icon/text/dot when practical.
- Preserve reduced-motion behavior.
- Native selects/options should remain readable in OS dropdowns.

If adding longer content pages, include a skip-to-content link hidden above viewport that slides to `top: 0.75rem` on focus, and use the standard clipped `.sr-only` pattern.

## Iconography

- Use `lucide-react` for UI icons.
- Keep icons small and wire-like: `size-3`, `size-3.5`, `size-4` in most UI; larger only when necessary.
- Common semantic pairings:
  - `ListTodo` for todo/list access.
  - `MessageSquare` for chat links.
  - `Plus` for create.
  - `X` for close/cancel.
  - `Search` for search.
  - `Calendar` for due dates.
  - `Mic` for recording/input.
  - `Send` for send.
  - `Trash2` for destructive delete/cancel recording.
  - `CheckCircle2` and `Circle` for todo status.
  - `ArrowDown` for scroll-to-bottom.
  - `Volume2` for source audio.

## Implementation guidance for future UI work

1. Start from an existing terminal component (`TerminalWindow`, `TerminalPanel`, `TerminalPageHeader`, shadcn primitive) and specialize with class names.
2. Choose colors by semantic meaning, not visual preference.
3. Keep spacing compact and terminal-like; default to `p-3`, `p-4`, `p-5`, `gap-2`, `gap-3` for utility surfaces.
4. Use borders and subtle tinted backgrounds instead of big shadows.
5. Avoid introducing generic SaaS patterns: big gradients, rounded pills everywhere, colorful illustrations, large whitespace-heavy cards, non-monospace UI type.
6. Preserve the full-bleed mobile terminal behavior and rounded desktop frame.
7. Preserve PT/EN and theme controls in the chrome unless a page intentionally supplies custom chrome controls.
8. If adding markdown/prose, use `.terminal-prose` and extend it globally only when needed.
9. If adding a new app-like module, model it after chat/todo: wide terminal window, dense controls, clear command prompts, semantic tiny labels, bordered panels.
10. If adding a marketing/info page, model it after welcome/privacy: header, panel/list content, prompt footer.
11. Run formatter/lint after changes when practical (`bun run check` or `bun run format:fix`).

## What not to do

- Do not add unrelated colors outside the token palette for normal UI.
- Do not bypass `data-theme` with one-off dark/light component branches unless a third-party imperative API requires raw colors.
- Do not replace the terminal frame with a generic page layout.
- Do not use large border radii by default; stay around `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl` for the terminal shell.
- Do not remove visible focus states.
- Do not use generic system UI fonts for body copy; keep IBM Plex Sans as `--font-sans` and JetBrains Mono as `--font-mono`.
- Do not scatter CSS into new global selectors for component-specific styling when Tailwind utilities will do.
- Do not edit generated files like `src/routeTree.gen.ts`.
