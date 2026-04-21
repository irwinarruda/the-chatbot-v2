# Style Guide — Terminal Aesthetic Design System

This document captures every design decision from the **irwin-notes** project. It provides the exact tokens, values, ratios, and patterns needed to recreate the same visual language in any framework or application.

---

## 1. Design Philosophy

The entire UI is a **terminal emulator** aesthetic — a macOS-style window frame containing monospaced content. The design creates the illusion of a developer's terminal with carefully chosen color semantics borrowed from terminal color schemes (green, amber, cyan, magenta, red, blue). Every surface, text color, and interactive state maps to a `term-*` design token.

---

## 2. Theme System

- Attribute-driven: `data-theme="dark"` or `data-theme="light"` on `<html>`.
- Default: **dark**.
- Persistence: cookie named `theme`, 1-year TTL.
- Flash prevention: an inline `<script>` reads the cookie synchronously before first paint and sets the attribute.
- React integration: `useSyncExternalStore` subscribes to a custom `"themechange"` window event — no React context or provider needed.

---

## 3. Color Palette

### 3.1 Surface Colors

| Token         | Dark      | Light     | Role                              |
| ------------- | --------- | --------- | --------------------------------- |
| `term-bg`     | `#0c1018` | `#eae8e4` | Page background, code block bg    |
| `term-window` | `#131a23` | `#faf8f5` | Main content panel                |
| `term-chrome` | `#1c2330` | `#e6e3de` | Title bar, hover card backgrounds |
| `term-border` | `#282f3c` | `#d1cdc6` | All borders, dividers, `<hr>`     |

### 3.2 Accent Colors

| Token                 | Dark      | Light     | Role                                                       |
| --------------------- | --------- | --------- | ---------------------------------------------------------- |
| `term-green`          | `#50dfaa` | `#0b7d4e` | Primary accent — headings, active nav, success, focus ring |
| `term-green-dim`      | `#3ab888` | `#0a7248` | Dimmed green variant                                       |
| `term-green-dot`      | `#27c93f` | `#22c55e` | macOS maximize dot                                         |
| `term-amber`          | `#ffb627` | `#a06000` | Dates, emphasis (`<em>`), inline code color, warnings      |
| `term-amber-strong`   | `#ffb627` | `#8a5200` | Deeper amber for highlighted suggestions                   |
| `term-red`            | `#ff5f56` | `#ef4444` | macOS close dot, errors, diff removals                     |
| `term-yellow`         | `#ffbd2e` | `#daa520` | macOS minimize dot                                         |
| `term-blue`           | `#58a6ff` | `#2563eb` | Links, inactive nav items, references                      |
| `term-cyan`           | `#7ee8fa` | `#067a96` | Link hover state, `<h3>` headings                          |
| `term-cyan-strong`    | `#7ee8fa` | `#0b6b85` | Tag text in post lists                                     |
| `term-magenta`        | `#d2a8ff` | `#7c4ddb` | "Exploring" category badges                                |
| `term-magenta-strong` | `#d2a8ff` | `#6f42c1` | Deeper magenta variant                                     |

### 3.3 Text Colors

| Token         | Dark      | Light     | Role                                              |
| ------------- | --------- | --------- | ------------------------------------------------- |
| `term-text`   | `#b0bec9` | `#4d5566` | Body text, paragraph text                         |
| `term-muted`  | `#8494a7` | `#5c6676` | Secondary text, metadata, line numbers, title bar |
| `term-bright` | `#f8fafc` | `#1c2028` | Emphasized text, `<strong>`, hover titles         |

### 3.4 Selection Colors

| Context    | Value                      |
| ---------- | -------------------------- |
| Dark bg    | `rgba(80, 223, 170, 0.15)` |
| Light bg   | `rgba(18, 165, 102, 0.18)` |
| Text color | `term-green`               |

### 3.5 Opacity Modifier Convention

Opacity suffixes are used extensively for subtle layering:

| Range               | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `/5`, `/8`          | Very subtle tints (badge/code backgrounds) |
| `/10`, `/12`, `/15` | Subtle rings, highlighted code lines       |
| `/20`, `/25`, `/30` | Borders, diff highlights, active states    |
| `/50`               | Medium emphasis rings, active indicators   |

---

## 4. Typography

### 4.1 Font Families

| Token          | Stack                                                                                                  | Usage                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `--font-mono`  | `JetBrains Mono`, `ui-monospace`, `Cascadia Code`, `Source Code Pro`, `Menlo`, `Consolas`, `monospace` | Everything — UI, nav, headings, code, metadata                   |
| `--font-serif` | `Georgia`, `"Times New Roman"`, `serif`                                                                | Prose body only — `<p>`, `<li>`, `<blockquote>` in blog articles |

`JetBrains Mono` is loaded via `next/font/google` with weights **300, 400, 500, 600, 700** and injected as CSS variable `--font-jetbrains-mono`.

### 4.2 Font Sizes

| Context               | Size                                                            | Line Height       |
| --------------------- | --------------------------------------------------------------- | ----------------- |
| Custom `text-2xs`     | `0.625rem`                                                      | `0.875rem`        |
| Chrome title bar      | `0.75rem` (xs)                                                  | default           |
| Metadata, tags        | `0.875rem` (sm)                                                 | default           |
| Body UI text          | `1rem` (base)                                                   | default           |
| Post titles in list   | `1.125rem` → `1.25rem` (lg → xl, responsive)                    | default           |
| Page headings         | `1.25rem` → `1.5rem` → `1.875rem` (xl → 2xl → 3xl, responsive)  | default           |
| Blog post title       | `1.5rem` → `1.875rem` → `2.25rem` (2xl → 3xl → 4xl, responsive) | tight             |
| Prose `<p>`, `<li>`   | `1.25rem`                                                       | `1.75` (unitless) |
| Prose `<h2>`          | `1.5rem`                                                        | default           |
| Prose `<h3>`          | `1.25rem`                                                       | default           |
| Code blocks (`<pre>`) | `0.875rem`                                                      | `1.7`             |
| Inline `<code>`       | `0.85em`                                                        | inherited         |
| Figcaption            | `0.75rem`                                                       | default           |

### 4.3 Font Weights

| Weight | Name     | Usage                                              |
| ------ | -------- | -------------------------------------------------- |
| `400`  | Normal   | Body text, general UI                              |
| `500`  | Medium   | Active nav links, `<h3>`, skip link, post titles   |
| `600`  | Semibold | `<h2>`, `<strong>`, list markers (`>` and numbers) |
| `700`  | Bold     | Page headings, name on about page                  |

### 4.4 Letter Spacing

| Context          | Value                       |
| ---------------- | --------------------------- |
| Page headings    | `tracking-tight` (-0.025em) |
| Chrome title bar | `tracking-wide` (0.025em)   |
| Prose `<h2>`     | `-0.01em`                   |

---

## 5. Layout & Spacing

### 5.1 Page Shell (Terminal Window)

```
+----------------------------------------------+
|  Outer: bg-term-bg, p-0 sm:p-6 md:p-10      |
|  +----------------------------------------+  |
|  | Chrome bar (title bar)                 |  |
|  | bg-term-chrome, border-term-border     |  |
|  | px-3 py-2 sm:px-4                     |  |
|  | [* * *]  [title]  [locale] [theme]    |  |
|  +----------------------------------------+  |
|  | Content area                           |  |
|  | bg-term-window                         |  |
|  | p-4 sm:p-7 md:p-9                     |  |
|  | shadow-2xl shadow-black/10             |  |
|  | max-w-4xl (896px)                      |  |
|  +----------------------------------------+  |
|  [    bottom shadow blur decoration      ]   |
+----------------------------------------------+
```

- **Max content width**: `max-w-4xl` (56rem / 896px)
- **Window corners**: `sm:rounded-t-xl` / `sm:rounded-b-xl` — no rounding on mobile
- **Border**: `1px solid term-border` — only on `sm:` and up
- **Bottom decorative shadow**: `mx-4 h-2 rounded-b-xl bg-black/20 blur-sm` (hidden on mobile)

### 5.2 Prose Content Spacing

| Element        | Margin / Padding                            |
| -------------- | ------------------------------------------- |
| `<h2>`         | `margin-top: 2em`, `margin-bottom: 0.75em`  |
| `<h3>`         | `margin-top: 1.5em`, `margin-bottom: 0.5em` |
| `<p>`          | `margin-bottom: 1em`                        |
| `<pre>`        | `padding: 1rem 1.25rem`, `margin: 1.25em 0` |
| `<blockquote>` | `padding-left: 1rem`, `margin: 1.25em 0`    |
| `<hr>`         | `margin: 2em 0`                             |
| `<ul>`, `<ol>` | `margin-bottom: 1em`                        |
| `<li>`         | `padding-left: 1.25em`                      |

### 5.3 Border Radius Scale

| Value                    | Usage                                     |
| ------------------------ | ----------------------------------------- |
| `0.75rem` (`rounded-xl`) | Terminal window corners                   |
| `0.5rem` (`rounded-lg`)  | Code blocks, callout boxes, cards, images |
| `0.375rem`               | Skip link                                 |
| `0.25rem` (`rounded`)    | Inline code, tech badges, locale switcher |
| `2px`                    | Focus ring border-radius                  |
| `50%` (`rounded-full`)   | macOS dots                                |

---

## 6. Component Patterns

### 6.1 macOS Window Dots

Three dots in the chrome bar, each `w-3 h-3 rounded-full`:

- **Close**: `bg-term-red`
- **Minimize**: `bg-term-yellow`
- **Maximize**: `bg-term-green-dot`

### 6.2 Navigation (Horizontal Link Bar)

- Container: `flex flex-wrap gap-x-6 gap-y-1 text-base`
- **Active** link: `text-term-green font-medium`
- **Inactive** link: `text-term-blue`
- **Hover**: `hover:text-term-cyan transition-colors duration-200`

### 6.3 Post List Entries

Each entry has a 2px left-border accent line via `::before` pseudo-element:

- Default border: `term-border`
- Hover border: `term-green` (0.3s ease transition)
- Card: `rounded-r-lg pl-5 py-3.5 hover:bg-term-chrome/50`
- **Title**: `text-term-bright` -> `group-hover:text-term-green`
- **Date**: `text-term-amber font-medium`
- **Description**: `text-term-text`
- **Tags**: `text-term-cyan-strong` prefixed with `#`
- **Draft badge**: `rounded border border-dashed border-term-amber/50 bg-term-amber/8 px-1.5 py-0.5 text-xs font-mono text-term-amber`

### 6.4 Badge / Tag Pattern

Three color-coded badge categories:

| Category  | Text Color                 | Background          | Border                   |
| --------- | -------------------------- | ------------------- | ------------------------ |
| Primary   | `text-term-cyan-strong`    | `bg-term-cyan/8`    | `border-term-cyan/15`    |
| Exploring | `text-term-magenta-strong` | `bg-term-magenta/8` | `border-term-magenta/15` |
| Tools     | `text-term-amber-strong`   | `bg-term-amber/8`   | `border-term-amber/15`   |

All badges share: `text-sm px-2 py-0.5 rounded border`

### 6.5 Project Cards

```
group rounded-lg border border-term-border/60 bg-term-chrome/30 p-3
transition-all duration-300
hover:border-term-green/30 hover:bg-term-chrome/50
```

Grid layout: `grid gap-3 sm:grid-cols-2`

### 6.6 Callout Box

```
my-6 rounded-lg border border-term-border bg-term-bg/70
px-4 py-3 text-base text-term-text
```

### 6.7 Image Container

```
rounded-lg overflow-hidden border-2 border-term-border
ring-1 ring-term-green/20 bg-term-bg
```

### 6.8 Score / Status Color Coding

| Threshold | Color                  |
| --------- | ---------------------- |
| >= 7.5    | `term-green` (good)    |
| >= 6.5    | `term-amber` (warning) |
| < 6.5     | `term-red` (bad)       |

### 6.9 Diff Colors

| Type     | Style                              |
| -------- | ---------------------------------- |
| Removal  | `bg-term-red/20 text-term-red`     |
| Addition | `bg-term-green/20 text-term-green` |

---

## 7. Prose / Blog Content Styling

The `.terminal-prose` class controls all rendered article content:

| Element                       | Color                                            | Font      | Weight |
| ----------------------------- | ------------------------------------------------ | --------- | ------ |
| `<h2>`                        | `term-green`                                     | mono      | 600    |
| `<h3>`                        | `term-cyan`                                      | mono      | 500    |
| `<p>`, `<li>`, `<blockquote>` | `term-text`                                      | serif     | 400    |
| `<strong>`                    | `term-bright`                                    | inherited | 600    |
| `<em>`                        | `term-amber` (italic)                            | inherited | —      |
| `<a>`                         | `term-blue`, hover: `term-cyan`                  | inherited | —      |
| `<code>` inline               | `term-amber` on `rgba(255,182,39,0.08)`          | mono      | —      |
| `<code>` block                | syntax-highlighted (Shiki)                       | mono      | —      |
| `<blockquote>`                | `term-text` italic, 2px `term-green` left border | serif     | —      |
| `<hr>`                        | 1px `term-border`                                | —         | —      |

**List bullets**: Unordered lists use the `>` character in `term-green` (600 weight). Ordered lists use monospace counter numbers in `term-green` (600 weight).

---

## 8. Animations & Transitions

### 8.1 Keyframe Animations

All animations are wrapped in `@media (prefers-reduced-motion: no-preference)`.

| Animation    | Keyframes                              | Duration | Easing                |
| ------------ | -------------------------------------- | -------- | --------------------- |
| `blink`      | opacity `1 -> 0 -> 1`                  | 1.1s     | step-end, infinite    |
| `glow-pulse` | opacity `1 -> 0.85 -> 1`               | 4s       | ease-in-out, infinite |
| `fade-in-up` | opacity 0 + translateY(8px) -> visible | 0.5s     | ease-out, fill both   |
| `typing`     | width `0 -> 100%`                      | —        | —                     |

### 8.2 Staggered Page Entrance

Each section of a page gets a sequential delay class:

- `.fade-in` — base (0s delay)
- `.fade-in-delay-1` through `.fade-in-delay-6` — increments of 0.1s

Applied in render order: nav -> header -> content sections. Creates a cascading reveal effect.

### 8.3 Transition Defaults

| Context                   | Value                              |
| ------------------------- | ---------------------------------- |
| Color hover (links, btns) | `transition-colors duration-200`   |
| Card hover (panels)       | `transition-all duration-300`      |
| Post left-border accent   | `transition: background 0.3s ease` |
| Skip link slide-in        | `transition: top 0.15s ease`       |
| Suggestion card entrance  | `fade-in-up 0.15s ease-out both`   |

---

## 9. Syntax Highlighting

| Setting                  | Value                                          |
| ------------------------ | ---------------------------------------------- |
| Library                  | `rehype-pretty-code` with Shiki                |
| Dark theme               | `github-dark`                                  |
| Light theme              | `github-light`                                 |
| `keepBackground`         | `false` (bg from design system)                |
| Code block bg            | `term-bg` (dark), `#ece8e1` (light)            |
| Code block border        | `1px solid term-border`, `0.5rem` radius       |
| Highlighted line (dark)  | `rgba(80, 223, 170, 0.08)`                     |
| Highlighted line (light) | `rgba(18, 165, 102, 0.12)`                     |
| Line numbers             | `term-muted`, `2rem` wide, `1rem` right margin |

Theme switching uses `--shiki-dark` / `--shiki-light` CSS custom properties toggled by `[data-theme]` selectors.

---

## 10. Accessibility

| Feature               | Implementation                                                     |
| --------------------- | ------------------------------------------------------------------ |
| Focus indicator       | `2px solid term-green`, `2px` offset, `2px` radius                 |
| Skip-to-content link  | Hidden above viewport, slides to `top: 0.75rem` on focus           |
| Screen reader utility | Standard `.sr-only` clip-rect pattern                              |
| Reduced motion        | All animations disabled for `prefers-reduced-motion: reduce`       |
| Text selection        | Custom green-tinted selection colors (see 3.4)                     |
| Scrollbar             | `scrollbar-width: thin`, `scrollbar-color: term-muted transparent` |
| External links        | `.sr-only` "(opens in new tab)" label                              |
| Font smoothing        | `antialiased` (webkit + moz)                                       |

---

## 11. Responsive Breakpoints

Standard Tailwind breakpoints:

| Breakpoint       | Width   | Layout Changes                                                |
| ---------------- | ------- | ------------------------------------------------------------- |
| Default (mobile) | < 640px | Full-bleed window, no padding, no border-radius, smaller text |
| `sm:`            | 640px   | Window gets `p-6`, rounded corners, borders appear            |
| `md:`            | 768px   | Larger padding (`p-10` outer, `p-9` inner), larger headings   |

Text sizes scale responsively, e.g. `text-xl sm:text-2xl md:text-3xl` for page headings.

---

## 12. Architectural Patterns

### 12.1 Component Hierarchy

```
Page (thin metadata wrapper, defines generateMetadata)
  +-- Screen (server component, data fetching)
      +-- TerminalWindow (shell frame)
            +-- Chrome bar (dots + title + locale switcher + theme toggle)
            +-- TerminalNav (horizontal links)
            +-- Content (screen-specific)
```

### 12.2 Server vs Client Split

- **Server components**: Everything — layouts, screens, terminal window, nav, links, callouts, images.
- **Client components** (`"use client"`): Only components requiring browser APIs or interactive state (theme toggle, interactive review tool).

### 12.3 CSS Architecture

- **Single file**: One `globals.css` — no CSS modules, no component-scoped styles.
- **Token layer**: All custom design tokens in one `@theme` block (Tailwind CSS v4).
- **Theme override**: Light mode is a complete token remap via `[data-theme="light"]` selector.
- **Component styles**: Tailwind utility classes exclusively.
- **Prose styles**: A single `.terminal-prose` class with traditional CSS selectors for blog article content.
- **Custom utility**: `text-2xs` defined via `@utility` directive.
  Oracle Cloud
  arruda.irwin@gmail.com
