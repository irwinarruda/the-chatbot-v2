# Themes

The web app has two palettes, each with a dark and a light variant:

- **Barro**, the default: [barro-theme](https://github.com/irwinarruda/barro-theme), the owner's brand theme. Slate (dark) and Kaolin (light) are cool slate surfaces with a brick accent. Primary buttons are brick, `#B64D3F`, with white text in both variants, and errors have their own red, `danger`, apart from the code colors. barro-theme's `palette.json` is the source of truth for those values; its `SPEC.md` says what each role is for, and `APPS.md` how an app uses them: it splits screens into app screens and [reading surfaces](#reading-surfaces), `TYPE.md` sets the [type](#type) and `PATTERNS.md` the recurring pieces, such as code blocks. This file applies the three to the app.
- **Favo**, the alternative: [favo-theme](https://github.com/irwinarruda/favo-theme)'s calm gray pair, Smoke (dark) and Veil (light). They are Honey and Wax with warm gray surfaces and honey buttons with dark text; favo-theme derives them in `src/palette.ts` from `palette.json`, and its `SPEC.md` ("Smoke and Veil") is the source of truth for those values. Favo has no `danger`, so its `danger` is its `regex`, the red it has always shown for errors.

## Choosing one

`<html data-palette="barro" | "favo" data-theme="dark" | "light">`. Both values live in the `the-chatbot-prefs` cookie (`PrefsDTO`), so the server renders the chosen palette on the first paint; a cookie without `palette` reads as Barro, and one with a palette the schema does not know, such as the removed `terminal`, falls back to the default prefs. `togglePalette` and `toggleTheme` in `PrefsService` save the cookie and set the attributes through `CookiePrefsGateway`. The title bar's swatch button switches the palette and the sun or moon switches the variant.

The logo is the brand, not the palette. It is the `>chatbot` wordmark, in the same rounded strokes as favo-cli's and Barro's, and its `o` is a speech bubble in Barro's brick, `#B64D3F`. The brick never changes; only the letters follow dark and light, through two files in `public/brand/`: `logo-dark.svg` has light letters for the dark variants and `logo-light.svg` dark letters for the light ones, and `AppShell` picks one from the theme. `logo.svg` has mid-gray letters for a place that cannot pick, and `mark*.svg` are the `>o` mark in the same three colors, all on a transparent background.

The favicon and app icon are the `>o` mark, a white chevron and the brick bubble, on a slate rounded tile: `icon.svg`, `apple-touch-icon.png` at 180 px (square, since iOS rounds it) and `icon-512.png` at 512 px. The `avatar*` files are the mark on a slate square, for profile pictures.

The whole brand set lives in `public/brand/`, and its `README.md` says where each file is used. Only `favicon.ico`, the tile at 16, 32 and 48 px, stays at the root of `public/`, because browsers ask for `/favicon.ico` by default. The root route links the ico, the svg and the touch icon. These are final assets: never redraw the logo, the mark, the tile or the avatars, or edit them by hand.

## Layers in `tailwind.css`

In source order, inside `@layer base`:

1. `:root`: the shadcn variables (`--background`, `--primary`, ...) and the app's signal variables, each pointing at a role. They are written once and shared by both palettes.
2. `[data-theme="light"]`: what every light variant changes besides colors: `color-scheme` and `scrim`.
3. `--palette-*`: each palette writes every color once, named after a theme role. `:root` holds Barro Slate, `[data-theme="light"]` Barro Kaolin, `[data-palette="favo"]` Smoke and `[data-palette="favo"][data-theme="light"]` Veil. All four blocks set the same 25 roles, so no variant inherits a color from another; `tests/client/shared/ThemePalettes.test.ts` fails otherwise, and also when anything but `destructive` reads `danger`, anything but `syntax-regex` reads `regex`, or anything but `success` and `info` reads their roles. No other place holds a hex value.

`@theme inline` then exposes the variables to Tailwind as `bg-*`, `text-*`, `border-*`. Tailwind's default palette is disabled (`--color-*: initial`), so a hue class renders nothing.

## Role map

| Token                                            | Role                                       | Barro (dark / light)                | Use                                          |
| ------------------------------------------------ | ------------------------------------------ | ----------------------------------- | -------------------------------------------- |
| `background`                                     | `background`                               | `#0b0e11` / `#f9fafc`               | the app window's body, page                  |
| `desk`                                           | `raised`                                   | `#181c20` / `#e7eaed`               | behind the app window                        |
| `card`                                           | `panel`                                    | `#111418` / `#eff2f5`               | the window's title bar, cards                |
| `muted`, `secondary`                             | `raised`                                   | `#181c20` / `#e7eaed`               | chrome, controls, hovered rows               |
| `popover`                                        | `float`                                    | `#06080b` / `#fcfdff`               | menus, popovers, dialogs                     |
| `accent`                                         | `accent` at 12% over `raised`              |                                     | hover surface of menu items                  |
| `foreground`                                     | `foreground`                               | `#e6eaef` / `#21272d`               | text                                         |
| `muted-foreground`                               | `comment`                                  | `#979fa8` / `#626a72`               | secondary text, kept AA on panels            |
| `faint`                                          | `faint`                                    | `#5d646b` / `#878d93`               | ignorable hints only                         |
| `border`, `input`                                | `border`                                   | `#2c3136` / `#d2d6db`               | borders                                      |
| `primary`, `primary-foreground`, `primary-hover` | `fill`, `onFill`, `fillHover`              | brick with white text               | primary buttons and other solid brand fills  |
| `brand-text`                                     | `accentText`                               | `#ec7d6b` / `#a23e31`               | brand-colored text and icons                 |
| `brand`, `ring`                                  | `accent`                                   | `#ec7d6b` / `#b64d3f`               | active indicators, tints, focus              |
| `success`                                        | `success`                                  | `#7ec259` / `#397900`               | paid, done, connected                        |
| `warning`                                        | `warning`                                  | straw                               | pending, unpaid, unsaved                     |
| `info`                                           | `info`                                     | `#5db0f5` / `#006eb0`               | links on app screens, informational tags     |
| `hint`                                           | `type`                                     | teal                                | hints, reasoning                             |
| `destructive`                                    | `danger`                                   | `#e95c5d` / `#c92b37`               | errors, deleted text, destructive actions    |
| `scrim`                                          | `float` (dark), `foreground` (light)       |                                     | overlays and shadows                         |
| `code`                                           | `background`                               | `#0b0e11` / `#f9fafc`               | code block surface                           |
| `syntax-*`                                       | the seven code colors                      | keyword clay, regex rose            | prose, code and fixed values such as amounts |

Each color has one job, so errors never borrow a code color: `destructive` reads `danger`, and `regex` is only for code. Barro's clay and its red are neighbors, so an error also says it is one, with an icon or a word, never by color alone. Text on a primary fill is `primary-foreground`, each palette's `onFill`: white on Barro's brick, near-black on Favo's honey. Brand-colored text is always `text-brand-text`, never `text-primary`: Barro's brick is 3.8:1 as text on Slate, and Veil's bright honey 1.7:1 on its surfaces, while each palette's `accentText` is 4.6:1 or better. Both light variants put `card` one step below `background`, so the title bar and cards sit a shade darker than the window body. That is why `success` and `info` are roles of their own and not the `string` and `function` code colors, which are tuned to `background`: on a light card those measured 4.25:1 in Kaolin and 4.24:1 in Veil. Each theme's `app/tokens.json` has status colors made to read there, sage (meadow in Favo) and sky at step 11, so status text on a light card now measures 4.78:1 in Kaolin and 4.88:1 in Veil. On a 10% tint of itself over a card, as in a status badge, it still falls to about 4.2:1. In Veil, `warning` and `brand-text` share a hex, so never place a warning badge next to brand text when the difference must read.

## Reading surfaces

barro-theme's `APPS.md` splits screens in two. App screens are controls and status, and follow the role map above. Reading surfaces are text someone reads top to bottom, and there color marks what kind of text each piece is, the way it does in code. Here they are the chat's bot replies, the note viewer and editor, and the privacy page. Each container carries the `reading-surface` class, and its rules in `tailwind.css` color the text:

| Text                                  | Color                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Body: paragraphs, list items, quotes  | `--reading-text`, `color-mix(in oklab, var(--foreground) 45%, var(--muted-foreground))` |
| Bold                                  | `foreground`, weight 700                                                        |
| Italics                               | `param`                                                                         |
| Links                                 | `function`, underlined at 40% and fully on hover                                |
| h1 and h2                             | `keyword`, in Chakra Petch                                                      |
| h3 to h6                              | `type`, in IBM Plex Sans                                                        |
| Inline code                           | `foreground` on `muted`, because `function` is taken by links                   |
| Code blocks                           | `foreground` on `code` with a `border`                                          |

Body text sits a step below `foreground` so bold has somewhere to go. It is a mix rather than a token, defined once on the container, so it works in both palettes. On `background`, every one of these reaches 4.5:1 in both light variants; the weakest are Veil's `type` subheadings at 4.62:1 and Kaolin's `function` links at 4.65:1.

`.terminal-prose` and `.notes-editor-content` keep only layout and sizes. MDXEditor colors its content from a stylesheet that loads after `tailwind.css`, so the editor applies `--reading-text` again with an extra class. In the chat only the bot reply is a reading surface. The user's bubble sits on `muted`, where Kaolin's `param` and `function` fall under 4.5:1, so it stays on app rules, and the chat's inline nodes carry no color of their own: the surface around them decides. List markers, quote borders and struck-through text keep their app colors.

Code blocks sit on `code`, which is each palette's `background` in both variants: the editor's own surface, the one its code colors are tuned to (`PATTERNS.md`, "Code"). One step darker, on Kaolin's `panel`, its weakest code colors fall to 4.25:1.

## Type

Three families, self-hosted in `public/fonts` and declared with `@font-face` at the top of `tailwind.css`, following barro-theme's `TYPE.md`:

- **IBM Plex Sans** (`font-sans`): interface text and chat replies.
- **JetBrains Mono** (`font-mono`): code, amounts in inputs and the locale chip.
- **Chakra Petch** (`font-display`): page titles and headings from 20px up, at weight 600 only, in sentence case, never 700 or capitals. `text-title` (26px) and `text-title-sm` (22px) replace `text-2xl` and `text-xl` on titles: the old size plus 2px, because Chakra Petch looks smaller. Prose h1 and h2 are 26px and 20px in the note viewer, 24px and 20px in the editor. Small headings, navigation, the title bar and key numbers stay in IBM Plex Sans.

Chakra Petch ships as one `woff2`, weight 600 in the latin range, which covers Portuguese. The root route preloads the latin file of each family, because every page but the chat shows a title. All three fonts are under the SIL Open Font License, and each `woff2` carries its copyright and the license link in its name table.

## Artifacts

Published artifacts render in a sandboxed iframe that cannot see the page's attributes, so they always use Favo Honey, whichever palette the app shows: the base stylesheet in `src/server/modules/artifacts/utils/artifact-html-compiler.ts` and `favo-honey.shiki.json`, which is favo-theme's VS Code theme reduced to what Shiki reads.

## Changing a color

Change a role in the palette's own block. For either palette, change its `palette.json` upstream first, then the matching values here. Never add a role one palette lacks; when a role is missing, use the next closest one.
