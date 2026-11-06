# Favo theme

The Chatbot uses [favo-theme](https://github.com/irwinarruda/favo-theme). Its `SPEC.md` and `palette.json` are the source of truth for colors and roles; this file explains how they map onto shadcn tokens here.

## Layers in `tailwind.css`

1. `--favo-*`: the palette, written once under `:root` (Honey) and once under `[data-theme="light"]` (Wax). No other place holds a hex value.
2. shadcn variables (`--background`, `--primary`, ...) and the app's signal variables, each pointing at a Favo role.
3. `@theme inline`: exposes them to Tailwind as `bg-*`, `text-*`, `border-*`. Tailwind's default palette is disabled (`--color-*: initial`), so a hue class renders nothing.

## Role map

| Token                                            | Favo role                                  | Use                                          |
| ------------------------------------------------ | ------------------------------------------ | -------------------------------------------- |
| `background`                                     | `background`                               | the app window's body, page                  |
| `desk`                                           | `raised`                                   | behind the app window, in both variants      |
| `card`                                           | `panel`                                    | the window's title bar, cards                |
| `muted`, `secondary`                             | `raised`                                   | chrome, controls, hovered rows               |
| `popover`                                        | `float`                                    | menus, popovers, dialogs                     |
| `accent`                                         | `accent` at 12% over `raised`              | hover surface of menu items                  |
| `foreground`                                     | `foreground`                               | text                                         |
| `muted-foreground`                               | `comment` (Honey), foreground at 70% (Wax) | secondary text, kept AA on panels            |
| `faint`                                          | `faint`                                    | ignorable hints only                         |
| `border`, `input`                                | `border`                                   | borders                                      |
| `primary`, `primary-foreground`, `primary-hover` | `fill`, `onFill`, `fillHover`              | primary actions, brand text                  |
| `brand`, `ring`                                  | `accent`                                   | active indicators, focus                     |
| `success`                                        | `string` (meadow)                          | paid, done, connected                        |
| `warning`                                        | `warning`                                  | pending, unpaid, unsaved                     |
| `info`                                           | `function` (sky)                           | links, informational tags                    |
| `hint`                                           | `type` (mint)                              | hints, reasoning                             |
| `destructive`                                    | `regex` (coral)                            | errors, destructive actions                  |
| `scrim`                                          | `float` (Honey), `foreground` (Wax)        | overlays and shadows                         |
| `code`                                           | `float` (Honey), `panel` (Wax)             | code block surface                           |
| `syntax-*`                                       | the seven code colors                      | prose, code and fixed values such as amounts |

In Wax, `warning` and `primary` share a hex, so never place a warning badge next to a primary one when the difference must read.

## Prose

`.terminal-prose`, the note editor and chat messages keep prose calm: headings in the sans font at weight 600 in `foreground`, bold text semibold `foreground`, italic text inheriting its color, inline code `function`, links `foreground` with a `type` underline, list markers and quote borders in `muted-foreground` and `border`. Syntax colors stay for code, not for emphasis.

## Artifacts

Published artifacts render in a sandboxed iframe that cannot see `data-theme`, so they always use Honey: the base stylesheet in `src/server/modules/artifacts/utils/artifact-html-compiler.ts` and `favo-honey.shiki.json`, which is favo-theme's VS Code theme reduced to what Shiki reads.

## Changing a color

Change `palette.json` upstream first, then the matching `--favo-*` values here. Never add a color the palette does not have; when a role is missing, use the next closest row, as SPEC asks.
