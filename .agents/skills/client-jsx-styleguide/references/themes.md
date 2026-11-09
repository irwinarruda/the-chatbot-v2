# Themes

The web app has two palettes, each with a dark and a light variant:

- **Barro**, the default: [barro-theme](https://github.com/irwinarruda/barro-theme), the owner's brand theme. Slate (dark) and Kaolin (light) are cool slate surfaces with a brick accent. Primary buttons are brick, `#B64D3F`, with white text in both variants, and errors have their own red, `danger`, apart from the code colors. barro-theme's `palette.json` is the source of truth for those values; its `SPEC.md` says what each role is for, and `APPS.md` how an app uses them.
- **Favo**, the alternative: [favo-theme](https://github.com/irwinarruda/favo-theme)'s calm gray pair, Smoke (dark) and Veil (light). They are Honey and Wax with warm gray surfaces and honey buttons with dark text; favo-theme derives them in `src/palette.ts` from `palette.json`, and its `SPEC.md` ("Smoke and Veil") is the source of truth for those values. Favo has no `danger`, so its `danger` is its `regex`, the red it has always shown for errors.

## Choosing one

`<html data-palette="barro" | "favo" data-theme="dark" | "light">`. Both values live in the `the-chatbot-prefs` cookie (`PrefsDTO`), so the server renders the chosen palette on the first paint; a cookie without `palette` reads as Barro, and one with a palette the schema does not know, such as the removed `terminal`, falls back to the default prefs. `togglePalette` and `toggleTheme` in `PrefsService` save the cookie and set the attributes through `CookiePrefsGateway`. The title bar's swatch button switches the palette and the sun or moon switches the variant.

The logo is the brand, not the palette. It is the `>chatbot` wordmark, in the same rounded strokes as favo-cli's and Barro's, and its `o` is a speech bubble in Barro's brick, `#B64D3F`. The brick never changes; only the letters follow dark and light, through two files in `public/brand/`: `logo-dark.svg` has light letters for the dark variants and `logo-light.svg` dark letters for the light ones, and `AppShell` picks one from the theme. `logo.svg` has mid-gray letters for a place that cannot pick, and `mark*.svg` are the `>o` mark in the same three colors, all on a transparent background.

The favicon and app icon are the `>o` mark, a white chevron and the brick bubble, on a slate rounded tile: `icon.svg`, `apple-touch-icon.png` at 180 px (square, since iOS rounds it) and `icon-512.png` at 512 px. The `avatar*` files are the mark on a slate square, for profile pictures.

The whole brand set lives in `public/brand/`, and its `README.md` says where each file is used. Only `favicon.ico`, the tile at 16, 32 and 48 px, stays at the root of `public/`, because browsers ask for `/favicon.ico` by default. The root route links the ico, the svg and the touch icon. These are final assets: never redraw the logo, the mark, the tile or the avatars, or edit them by hand.

## Layers in `tailwind.css`

In source order, inside `@layer base`:

1. `:root`: the shadcn variables (`--background`, `--primary`, ...) and the app's signal variables, each pointing at a role. They are written once and shared by both palettes.
2. `[data-theme="light"]`: what every light variant changes besides colors: `color-scheme`, `scrim` and `code`.
3. `--palette-*`: each palette writes every color once, named after a theme role. `:root` holds Barro Slate, `[data-theme="light"]` Barro Kaolin, `[data-palette="favo"]` Smoke and `[data-palette="favo"][data-theme="light"]` Veil. All four blocks set the same 23 roles, so no variant inherits a color from another; `tests/client/shared/ThemePalettes.test.ts` fails otherwise, and also when anything but `destructive` reads `danger` or anything but `syntax-regex` reads `regex`. No other place holds a hex value.

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
| `success`                                        | `string`                                   | green                               | paid, done, connected                        |
| `warning`                                        | `warning`                                  | straw                               | pending, unpaid, unsaved                     |
| `info`                                           | `function`                                 | blue                                | links, informational tags                    |
| `hint`                                           | `type`                                     | teal                                | hints, reasoning                             |
| `destructive`                                    | `danger`                                   | `#e95c5d` / `#c92b37`               | errors, deleted text, destructive actions    |
| `scrim`                                          | `float` (dark), `foreground` (light)       |                                     | overlays and shadows                         |
| `code`                                           | `float` (dark), `panel` (light)            |                                     | code block surface                           |
| `syntax-*`                                       | the seven code colors                      | keyword clay, regex rose            | prose, code and fixed values such as amounts |

Each color has one job, so errors never borrow a code color: `destructive` reads `danger`, and `regex` is only for code. Barro's clay and its red are neighbors, so an error also says it is one, with an icon or a word, never by color alone. Text on a primary fill is `primary-foreground`, each palette's `onFill`: white on Barro's brick, near-black on Favo's honey. Brand-colored text is always `text-brand-text`, never `text-primary`: Barro's brick is 3.8:1 as text on Slate, and Veil's bright honey 1.7:1 on its surfaces, while each palette's `accentText` is 4.6:1 or better. Both light variants put `card` one step below `background`, so the title bar and cards sit a shade darker than the window body. Kaolin's code colors are tuned against its `background`, so `success` and `info` text measure about 4.3:1 on a Kaolin card, just under AA. In Veil, `warning` and `brand-text` share a hex, so never place a warning badge next to brand text when the difference must read.

## Prose

`.terminal-prose`, the note editor and chat messages keep prose calm in both palettes: headings in the sans font at weight 600 in `foreground`, bold text semibold `foreground`, italic text inheriting its color, inline code `function`, links `foreground` with a `type` underline, list markers and quote borders in `muted-foreground` and `border`. Syntax colors stay for code, not for emphasis.

## Artifacts

Published artifacts render in a sandboxed iframe that cannot see the page's attributes, so they always use Favo Honey, whichever palette the app shows: the base stylesheet in `src/server/modules/artifacts/utils/artifact-html-compiler.ts` and `favo-honey.shiki.json`, which is favo-theme's VS Code theme reduced to what Shiki reads.

## Changing a color

Change a role in the palette's own block. For either palette, change its `palette.json` upstream first, then the matching values here. Never add a role one palette lacks; when a role is missing, use the next closest one.
