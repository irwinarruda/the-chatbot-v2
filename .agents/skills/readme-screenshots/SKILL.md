---
name: readme-screenshots
description: Use when a README image is stale, a change alters what a web screen shows, a feature is added that the README should show, or the request is to retake, refresh, regenerate or add a screenshot, a print or a picture of The Chatbot. Also use when the request only says "update the images", "show this feature in the README" or "run the app without a backend". Not for the logo or favicon in public/.
---

# README screenshots

Every picture of the app in the README comes from one command, so they all look the same and any of them can be retaken.

```sh
bun run screenshots              # every scene, into docs/assets
bun run screenshots chat todos   # just these
bun run dev:mock                 # the app on demo data at http://localhost:3300, by hand
SCREENSHOTS_DIR=/tmp/try bun run screenshots   # try it without touching docs/assets
```

Each scene reports `changed` or `unchanged`, and only a changed picture is written, so `git status docs/assets` lists exactly the pictures that changed. If a picture you did not expect is listed, find out why before committing it. Chromium renders the same page to the same bytes on one machine, so the comparison is on bytes.

## How it works

`bun run dev:mock` is `vite dev --mode mock`, the web app alone, the way favo-cli's `dev:mock` runs its TUI with no backend. `vite.config.ts` gives TanStack Start two mock entry points:

- `src/client/mock/router.tsx` calls `bootstrapMockContainer()`, so every client service resolves the `Test*` repositories in `src/client/mock/repositories/` instead of the API, and `TestSessionRepository` signs every page in except `/login` and `/not-registered`, so those two screens can be shown.
- `src/client/mock/start.ts` replaces the server middleware with the prefs cookie and a 501 for every server route (`/api/`, `/g/`), so the backend is never built and a stray API call fails loudly.

`.env.mock` only sets the port. Nothing else knows mock mode exists, and a production build never contains it; the architecture test fails if production code imports `src/client/mock`.

`src/client/mock/db.ts` is the demo data: one fictional person, Ada Hale, with a chat, todos, notes, transactions, bills and artifacts, all dated around `DemoNow` (November 3, 2026). The `Test*` repositories read and change it, so the app is usable by hand. Keep it fictional, in English, and typed by the contracts; `tests/client/shared/MockDb.test.ts` parses it through them, so a contract change that the demo data misses fails a test.

`src/client/mock/scenes.ts` is the table of pictures: each scene names its path, theme, viewport and a text that proves the data loaded. The scene name is the file name in `docs/assets`. `infra/scripts/screenshots.ts` starts `dev:mock` unless one is already answering, warms every path once so Vite finishes optimizing, then opens each scene in Playwright's Chromium and shoots it.

## The standard

These live at the top of `infra/scripts/screenshots.ts` and in `SceneViewport`. Change them only to change every picture at once.

| What       | Value                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Image      | the viewport at 2x: 2560×1600 for desktop                                    |
| Viewport   | desktop 1280×800, phone 390×844                                             |
| Browser    | Playwright's Chromium, `en-US`, `America/Sao_Paulo`, reduced motion         |
| Clock      | fixed at `DemoNow`, so relative dates and the current month never drift     |
| App prefs  | `en` and the scene's theme through the `the-chatbot-prefs` cookie, on the default Barro palette |
| Fonts      | the ones bundled in `public/fonts`, so the machine's fonts do not matter    |

## Add a picture

1. Make the screen show something worth seeing in `db.ts`, if the demo data does not already.
2. Add a scene to `Scenes`, with a `waitFor` text that only appears once the data has loaded.
3. Run `bun run dev:mock` and open the path to check it by hand.
4. Run `bun run screenshots <scene>`, and read the image.
5. Add it to the README with alt text that describes what the picture shows. The hero is `home-dark` and `home-light` with `#gh-dark-mode-only` and `#gh-light-mode-only`; other pictures use `width="760"`, or `width="380"` inside the workspace table.

A scene the README does not use is noise: remove it with its picture.

## Before you say it is done

Read each changed image, and check:

- The screen is the one you meant and shows loaded data, not a skeleton or an error.
- Chat text uses WhatsApp formatting (`*bold*`, `_italic_`), because chat messages render it; notes use Markdown.
- The README's words and alt text still match the picture.

## Requirements

Chromium for the pinned Playwright (`bunx playwright install chromium` once), and port 3300 free or already running `dev:mock`. No database, Docker or credentials. A full run takes about a minute and does not take over the screen.
