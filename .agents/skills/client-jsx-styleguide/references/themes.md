# Themes

The web app has two palettes, each with a dark and a light variant:

- **Terminal**, the default: the app's original cool blue-gray surfaces with a green accent.
- **Favo**, the alternative: [favo-theme](https://github.com/irwinarruda/favo-theme)'s Honey (dark) and Wax (light). Its `SPEC.md` and `palette.json` are the source of truth for those values.

## Choosing one

`<html data-palette="terminal" | "favo" data-theme="dark" | "light">`. Both values live in the `the-chatbot-prefs` cookie (`PrefsDTO`), so the server renders the chosen palette on the first paint; a cookie without `palette` reads as Terminal. `togglePalette` and `toggleTheme` in `PrefsService` save the cookie and set the attributes through `CookiePrefsGateway`. The title bar's swatch button switches the palette and the sun or moon switches the variant.

The logo and favicon follow the palette: `public/logo.svg`, `public/logo-light.svg` and `public/favicon.ico` for Terminal, and the same names with `-favo` for Favo. `AppShell` picks the logo and the root document renders `<link rel="icon">` from the current prefs, so both change the moment the palette does.

## Layers in `tailwind.css`

In source order, inside `@layer base`:

1. `:root`: the shadcn variables (`--background`, `--primary`, ...) and the app's signal variables, each pointing at a role. They are written once and shared by both palettes.
2. `[data-theme="light"]`: what every light variant changes besides colors: `color-scheme`, `scrim` and `code`.
3. `--palette-*`: each palette writes every color once, named after a Favo role. `:root` holds Terminal dark, `[data-theme="light"]` Terminal light, `[data-palette="favo"]` Honey and `[data-palette="favo"][data-theme="light"]` Wax. All four blocks set the same 21 roles, so no variant inherits a color from another; `tests/client/shared/ThemePalettes.test.ts` fails otherwise. No other place holds a hex value.

`@theme inline` then exposes the variables to Tailwind as `bg-*`, `text-*`, `border-*`. Tailwind's default palette is disabled (`--color-*: initial`), so a hue class renders nothing.

## Role map

| Token                                            | Role                                       | Terminal (dark / light)            | Use                                          |
| ------------------------------------------------ | ------------------------------------------ | ---------------------------------- | -------------------------------------------- |
| `background`                                     | `background`                               | `#0c1018` / `#eae8e4`              | the app window's body, page                  |
| `desk`                                           | `raised`                                   | `#1c2330` / `#e6e3de`              | behind the app window                        |
| `card`                                           | `panel`                                    | `#131a23` / `#faf8f5`              | the window's title bar, cards                |
| `muted`, `secondary`                             | `raised`                                   | `#1c2330` / `#e6e3de`              | chrome, controls, hovered rows               |
| `popover`                                        | `float`                                    | `#080b11` / `#faf8f5`              | menus, popovers, dialogs                     |
| `accent`                                         | `accent` at 12% over `raised`              |                                    | hover surface of menu items                  |
| `foreground`                                     | `foreground`                               | `#f8fafc` / `#1c2028`              | text                                         |
| `muted-foreground`                               | `comment` (foreground at 70% in Wax)       | `#8494a7` / `#5c6676`              | secondary text, kept AA on panels            |
| `faint`                                          | `faint`                                    | `#5c6676` / `#8494a7`              | ignorable hints only                         |
| `border`, `input`                                | `border`                                   | `#282f3c` / `#d1cdc6`              | borders                                      |
| `primary`, `primary-foreground`, `primary-hover` | `fill`, `onFill`, `fillHover`              | green                              | primary actions, brand text                  |
| `brand`, `ring`                                  | `accent`                                   | green                              | active indicators, focus                     |
| `success`                                        | `string`                                   | green                              | paid, done, connected                        |
| `warning`                                        | `warning`                                  | amber                              | pending, unpaid, unsaved                     |
| `info`                                           | `function`                                 | blue                               | links, informational tags                    |
| `hint`                                           | `type`                                     | cyan                               | hints, reasoning                             |
| `destructive`                                    | `regex`                                    | red                                | errors, destructive actions                  |
| `scrim`                                          | `float` (dark), `foreground` (light)       |                                    | overlays and shadows                         |
| `code`                                           | `float` (dark), `panel` (light)            |                                    | code block surface                           |
| `syntax-*`                                       | the seven code colors                      | keyword green, constant magenta    | prose, code and fixed values such as amounts |

Terminal dark's `float` is one step below its background, the way Honey's is, so dialogs and menus separate from the page and the overlay dims it. Terminal light's signal text (`warning`, `info`, `hint`, `success`, `destructive`) uses the old theme's darker text shades, or one step darker in the same hue where it had none, so it stays AA on every surface. Terminal's foreground is its old bright heading color, not its softer body gray, because the shell uses one `foreground` for titles and body and leans on the gap to `muted-foreground` for hierarchy. In Wax, `warning` and `primary` share a hex, so never place a warning badge next to a primary one when the difference must read.

## Prose

`.terminal-prose`, the note editor and chat messages keep prose calm in both palettes: headings in the sans font at weight 600 in `foreground`, bold text semibold `foreground`, italic text inheriting its color, inline code `function`, links `foreground` with a `type` underline, list markers and quote borders in `muted-foreground` and `border`. Syntax colors stay for code, not for emphasis.

## Artifacts

Published artifacts render in a sandboxed iframe that cannot see the page's attributes, so they always use Favo Honey, whichever palette the app shows: the base stylesheet in `src/server/modules/artifacts/utils/artifact-html-compiler.ts` and `favo-honey.shiki.json`, which is favo-theme's VS Code theme reduced to what Shiki reads.

## Changing a color

Change a role in the palette's own block. For Favo, change `palette.json` upstream first, then the matching values here. Never add a role one palette lacks; when a role is missing, use the next closest one.
