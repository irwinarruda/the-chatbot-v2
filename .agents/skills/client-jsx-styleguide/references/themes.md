# Themes

The web app has two palettes, each with a dark and a light variant:

- **Barro**, the default: [barro-theme](https://github.com/irwinarruda/barro-theme), the owner's brand theme. Slate (dark) and Kaolin (light) are cool slate surfaces with a brick accent. Primary buttons are brick, `#B64D3F`, with white text in both variants, and errors have their own red, `danger`, apart from the code colors and tuned to sit apart from the brick. barro-theme's `palette.json` is the source of truth for the surfaces and the code colors, and its `app/tokens.json` for what an app adds to them: brand text, reading text, the status colors with their soft background and line, the destructive solid and the border of controls. Its `SPEC.md` says what each role is for, and `APPS.md` how an app uses them: it splits screens into app screens and [reading surfaces](#reading-surfaces), `TYPE.md` sets the [type](#type) and `PATTERNS.md` the recurring pieces, such as code blocks. This file applies the three to the app.
- **Favo**, the alternative: [favo-theme](https://github.com/irwinarruda/favo-theme)'s calm gray pair, Smoke (dark) and Veil (light). They are Honey and Wax with warm gray surfaces and honey buttons with dark text; favo-theme derives them in `src/palette.ts` from `palette.json`, and its `SPEC.md` ("Smoke and Veil") is the source of truth for those values. What an app adds comes from its `app/tokens.json`, on the `gray` neutral. Favo's `danger` is coral, the color of its `regex` and the red it has always shown for errors.

## Choosing one

`<html data-palette="barro" | "favo" data-theme="dark" | "light">`. Both values live in the `the-chatbot-prefs` cookie (`PrefsDTO`), so the server renders the chosen palette on the first paint; a cookie without `palette` reads as Barro, and one with a palette the schema does not know, such as the removed `terminal`, falls back to the default prefs. `togglePalette` and `toggleTheme` in `PrefsService` save the cookie and set the attributes through `CookiePrefsGateway`. The title bar's swatch button switches the palette and the sun or moon switches the variant.

The logo is the brand, not the palette. It is the `>chatbot` wordmark, in the same rounded strokes as favo-cli's and Barro's, and its `o` is a round speech bubble with a small 60° tail, in Barro's brick, `#B64D3F`. The marks are generated in irwin-ui (`BRAND.md`) and copied into `public/brand/`. The brick never changes; only the letters follow dark and light, through two files in `public/brand/`: `logo-dark.svg` has light letters for the dark variants and `logo-light.svg` dark letters for the light ones, and `AppShell` picks one from the theme. `logo.svg` has mid-gray letters for a place that cannot pick, and `mark*.svg` are the `>o` mark in the same three colors, all on a transparent background.

The favicon and app icon are the `>o` mark, a white chevron and the brick bubble, on a slate rounded tile: `icon.svg`, `apple-touch-icon.png` at 180 px (square, since iOS rounds it) and `icon-512.png` at 512 px. The `avatar*` files are the mark on a slate square, for profile pictures.

The whole brand set lives in `public/brand/`, and its `README.md` says where each file is used. Only `favicon.ico`, the tile at 16, 32 and 48 px, stays at the root of `public/`, because browsers ask for `/favicon.ico` by default. The root route links the ico, the svg and the touch icon. These are final assets: never redraw the logo, the mark, the tile or the avatars, or edit them by hand.

## Layers in `tailwind.css`

In source order, inside `@layer base`:

1. `:root`: the shadcn variables (`--background`, `--primary`, ...) and the app's signal variables, each pointing at a role. They are written once and shared by both palettes.
2. `[data-theme="light"]`: what every light variant changes besides colors: `color-scheme` and `scrim`.
3. `--palette-*`: each palette writes every color once, named after a theme role. `:root` holds Barro Slate, `[data-theme="light"]` Barro Kaolin, `[data-palette="favo"]` Smoke and `[data-palette="favo"][data-theme="light"]` Veil. All four blocks set the same 35 roles, so no variant inherits a color from another; `tests/client/shared/ThemePalettes.test.ts` fails otherwise. It also fails when a role is wired to the wrong token (anything but `destructive` reading `danger`, anything but `syntax-regex` reading `regex`), and when a palette's own values break a contrast rule: status or brand text on its soft background, or text on a primary button, under 4.5:1. No other place holds a hex value.

`@theme inline` then exposes the variables to Tailwind as `bg-*`, `text-*`, `border-*`. Tailwind's default palette is disabled (`--color-*: initial`), so a hue class renders nothing.

## Role map

| Token                                                                    | Role                                           | Barro (dark / light)                          | Use                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `background`                                                             | `background`                                   | `#0b0e11` / `#f9fafc`                         | the app window's body, page, the fill of inputs |
| `desk`                                                                   | `raised`                                       | `#181c20` / `#e7eaed`                         | behind the app window                           |
| `card`                                                                   | `panel`                                        | `#111418` / `#eff2f5`                         | the window's title bar, cards, form dialogs     |
| `muted`, `secondary`                                                     | `raised`                                       | `#181c20` / `#e7eaed`                         | chrome, hovered rows and controls               |
| `popover`                                                                | `float`                                        | `#06080b` / `#fcfdff`                         | menus, popovers, confirmations                  |
| `accent`                                                                 | `accent` at 12% over `raised`                  |                                               | hover surface, under `foreground` text only     |
| `foreground`                                                             | `foreground`                                   | `#e6eaef` / `#21272d`                         | text                                            |
| `muted-foreground`                                                       | `comment`                                      | `#979fa8` / `#626a72`                         | secondary text, kept AA on panels               |
| `faint`                                                                  | `faint`                                        | `#5d646b` / `#878d93`                         | ignorable hints only                            |
| `border`                                                                 | `border`                                       | `#2c3136` / `#d2d6db`                         | borders of cards, separators                    |
| `input`                                                                  | `border`                                       | `#2c3136` / `#d2d6db`                         | borders of inputs and selects, around a `bg-input/30` fill |
| `primary`, `primary-foreground`, `primary-hover`                         | `fill`, `on-fill`, `fill-hover`                | brick with white text                         | primary buttons and other solid brand fills     |
| `brand-text`                                                             | `accent-text`                                  | `#ec7d6b` / `#b74133`                         | brand-colored text and icons                    |
| `brand-soft`                                                             | `accent-soft`                                  | `#271714` / `#fee3de`                         | behind brand text: the current tab, icon chips  |
| `brand`, `ring`                                                          | `accent`                                       | `#ec7d6b` / `#b64d3f`                         | active outlines, focus, the cursor              |
| `success`, `success-soft`, `success-line`                                | the same                                       | `#7ec259` / `#397800` on `#141f0f` / `#dff0d8` | paid, done, connected                           |
| `warning`, `warning-soft`, `warning-line`                                | the same                                       | `#f0bf54` / `#876300` on `#221a0a` / `#f5e8d1` | pending, unpaid, unsaved                        |
| `info`, `info-soft`, `info-line`                                         | the same                                       | `#5db0f5` / `#006eb0` on `#101d28` / `#d9ecfe` | links on app screens, informational tags        |
| `hint`                                                                   | `type`                                         | teal                                          | hints, reasoning                                |
| `destructive`, `destructive-soft`, `destructive-line`                    | `danger`, `danger-soft`, `danger-line`         | `#e95c5d` / `#c72835` on `#2c1313` / `#ffe2e0` | errors, negative balances, deleted text         |
| `fg-reading`                                                             | `fg-reading`                                   | `#bac0c7` / `#434a51`                         | body text on a reading surface                  |
| `scrim`                                                                  | `float` (dark), `foreground` (light)           |                                               | overlays and shadows                            |
| `code`                                                                   | `background`                                   | `#0b0e11` / `#f9fafc`                         | code block surface                              |
| `syntax-*`                                                               | the seven code colors                          | keyword clay, regex rose                      | prose, code and fixed values such as amounts    |

The surfaces, `foreground`, `comment`, `faint`, `border`, `accent`, the fill and the code colors are the editor palette's. The rest is the theme's app palette, `app/tokens.json`, where every color has twelve steps with the same job in dark and light:

| Role                                              | Theme token                                         | Step               |
| ------------------------------------------------- | --------------------------------------------------- | ------------------ |
| `fg-reading`                                      | `fg-reading`                                        | neutral 12 and 11, mixed |
| `accent-text`, `accent-soft`                      | `primary-fg`, `primary-soft`                        | brand 11 and 3     |
| `<status>`, `<status>-soft`, `<status>-line`      | the same                                            | 11, 3 and 6        |

Each color has one job, so errors never borrow a code color: `destructive` reads `danger`, and `regex` is only for code. Barro's red is a plain red, close to its clay. A hue nearer to crimson was tried to separate them and set aside: it read as pink, not as an error, and Favo's warning is its honey, the same hex as its brand text in both variants. So a status says what it is with an icon or a word, never by color alone, and a warning badge never sits next to brand text when the difference must read. Text on a primary fill is `primary-foreground`, each palette's `on-fill`: white on Barro's brick, near-black on Favo's honey. Brand-colored text is always `text-brand-text`, never `text-primary`: Barro's brick is 3.8:1 as text on Slate, and Veil's bright honey 1.7:1 on its surfaces, while each palette's brand text is 4.9:1 or better on a card. Both light variants put `card` one step below `background`, so the title bar and cards sit a shade darker than the window body. That is why status text is step 11 of the app palette and not a code color, which is tuned to `background` alone: step 11 reads on every surface of the app, and its weakest pairs are Kaolin's `success` at 4.50:1 on `muted` and 4.84:1 on a card.

## Soft backgrounds

A badge, a chip or a banner is soft, as irwin-ui's `COLOR.md` ("App screens") and `PATTERNS.md` ("Inputs and badges") ask: `bg-<status>-soft` behind, `text-<status>` on it and `border-<status>-line` around, with `destructive` standing for danger. `Badge` has a `success`, a `warning`, an `info` and a `destructive` variant, and `Alert` a `destructive` one; an icon chip, as in `ConfirmDialog` and the cash flow rows, takes the first two classes. The brand's soft background is `bg-brand-soft` under `text-brand-text`: the current tab, a pressed chrome button, a brand-colored icon button when hovered.

Never build one from opacity (`bg-success/10`, `bg-brand/12`). A tint lands between two steps of the theme, where nothing is checked: status text on a 10% tint of itself measured about 4.2:1 in the light variants. On its soft background it measures at least 4.5:1 in all four palettes; the weakest are Kaolin's `info` at 4.51:1 and its brand text at 4.52:1, and Veil's `danger` at 4.54:1. Opacity stays for what carries no text: borders, rings, shadows and text decorations (`border-brand/25`, `ring-destructive/30`). `accent`, the hover surface, is the one mix left under text, and only under `foreground`, which stays above 9.8:1 on it; colored text that is hovered moves to its own soft background (`hover:bg-destructive-soft hover:text-destructive`).

## Destructive actions

`destructive` is the red for text and icons: an error, an overdue date, a balance that went negative. A destructive button is `Button`'s `destructive` variant: `bg-destructive-soft` behind `text-destructive`, a secondary button in red. It is never a solid fill. A solid red was tried, and it drew more attention than the primary button beside it, so a Delete outshouted a Save in the same dialog. The rule is irwin-ui's (`PATTERNS.md`, "Buttons"): one primary action per view, and a destructive action is never louder than it. A destructive item in a menu and a quiet destructive button, such as Revoke or Log out, stay text: `text-destructive`, on `destructive-soft` when focused or hovered.

## Depth and controls

Surfaces have a depth, and it has to read the same everywhere (irwin-ui `COLOR.md`, "Depth"). An input, a textarea or a select is a well in the dialog or card that holds it: `bg-input/30`, a step darker than it in the light variants and a step lighter in the dark ones, inside the same quiet border as a card, since `input` reads `border`. Filling the fields with `background` and giving them a strong border was tried, to reach 3:1 on the border. It made them lighter than their dialog in light and darker in dark, the reverse of every other screen, and it looked wrong at once, in Barro and in Favo. The fill and the label are what show a field, not a heavy border. A checkbox keeps its `muted-foreground` border, and the chat composer keeps `border`.

## Reading surfaces

irwin-ui's `COLOR.md` splits screens in two. App screens are controls and status, and follow the role map above. Reading surfaces are text someone reads top to bottom, and there color marks what kind of text each piece is, the way it does in code. Here they are the chat's bot replies, the note viewer and editor, and the privacy page. Each container carries the `reading-surface` class, and its rules in `tailwind.css` color the text:

| Text                                  | Color                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Body: paragraphs, list items, quotes  | `fg-reading`, the theme's reading tone                                          |
| Bold                                  | `foreground`, weight 700                                                        |
| Italics                               | `param`                                                                         |
| Links                                 | `function`, underlined at 40% and fully on hover                                |
| h1 and h2                             | `keyword`, in Chakra Petch                                                      |
| h3 to h6                              | `type`, in IBM Plex Sans                                                        |
| Inline code                           | `foreground` on `muted`, because `function` is taken by links                   |
| Code blocks                           | `foreground` on `code` with a `border`                                          |

Body text sits a step below `foreground` so bold has somewhere to go. It is the theme's `fg-reading`, `fg` and `fg-muted` mixed 45 to 55 in OKLab, a palette role set once on the container. On `background`, every one of these reaches 4.5:1 in both light variants; the weakest are Veil's `type` subheadings at 4.62:1 and Kaolin's `function` links at 4.65:1.

`.terminal-prose` and `.notes-editor-content` keep only layout and sizes. MDXEditor colors its content from a stylesheet that loads after `tailwind.css`, so the editor applies `--fg-reading` again with an extra class. In the chat only the bot reply is a reading surface. The user's bubble sits on `muted`, where Kaolin's `param` and `function` fall under 4.5:1, so it stays on app rules, and the chat's inline nodes carry no color of their own: the surface around them decides. List markers, quote borders and struck-through text keep their app colors.

Code blocks sit on `code`, which is each palette's `background` in both variants: the editor's own surface, the one its code colors are tuned to (`PATTERNS.md`, "Code"). One step darker, on Kaolin's `panel`, its weakest code colors fall to 4.25:1.

## Type

Three families, self-hosted in `public/fonts` and declared with `@font-face` at the top of `tailwind.css`, following irwin-ui's `TYPE.md`:

- **IBM Plex Sans** (`font-sans`): interface text and chat replies.
- **JetBrains Mono** (`font-mono`): code, amounts in inputs and the locale chip.
- **Chakra Petch** (`font-display`): page titles and headings from 20px up, at weight 600 only, in sentence case, never 700 or capitals. `text-title` (26px) and `text-title-sm` (22px) replace `text-2xl` and `text-xl` on titles: the old size plus 2px, because Chakra Petch looks smaller. Prose h1 and h2 are 26px and 20px in the note viewer, 24px and 20px in the editor. Small headings, navigation, the title bar and key numbers stay in IBM Plex Sans.

Chakra Petch ships as one `woff2`, weight 600 in the latin range, which covers Portuguese. The root route preloads the latin file of each family, because every page but the chat shows a title. All three fonts are under the SIL Open Font License, and each `woff2` carries its copyright and the license link in its name table.

## Artifacts

Published artifacts render in a sandboxed iframe that cannot see the page's attributes, so they always use Favo Honey, whichever palette the app shows: the base stylesheet in `src/server/modules/artifacts/utils/artifact-html-compiler.ts` and `favo-honey.shiki.json`, which is favo-theme's VS Code theme reduced to what Shiki reads.

## Changing a color

Change a role in the palette's own block. For either palette, change the theme upstream first, `palette.json` for a surface or a code color and the generator behind `app/tokens.json` for the rest, then the matching values here. Never add a role one palette lacks; when a role is missing, use the next closest one.
