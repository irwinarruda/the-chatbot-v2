---
name: the-chatbot-artifact
description: Use when the user names The Chatbot, asks to log in or connect an agent to it, or asks to publish or update a The Chatbot artifact, or wants a deliverable — plan, report, proposal, dashboard, diagram — as a shareable HTML page and no built-in artifact tool is available. Not for plain-text answers or files the user only wants locally.
---

# The Chatbot Artifact

Turn the user's material into one self-contained HTML document, then publish it with the bundled script. Keep artifacts private unless the user explicitly requests public access.

## Workflow

1. Decide whether to create a new artifact or update a known artifact ID.
2. Author an HTML document in a local `.html` file. Preserve the source file so it can be revised.
3. Follow the allowed-content contract below. Do not rely on content that the server will remove.
4. Run `scripts/publish.mjs` with a clear title. Add `--public` only when public access was explicitly requested. Add `--id` to keep an existing link stable.
5. If the server returns validation violations, repair the HTML and retry. Never weaken or work around the server rules.
6. Return the artifact URL, visibility, and whether it was created or updated.

`<skill-dir>` below is the directory that holds this `SKILL.md`. It changes with the agent and the install method, so resolve it instead of assuming a path.

Use the default configured environment:

```bash
node <skill-dir>/scripts/publish.mjs \
  ./artifact.html --title "Architecture proposal"
```

For an explicit public artifact:

```bash
node <skill-dir>/scripts/publish.mjs \
  ./artifact.html --title "Public roadmap" --public
```

For an update that preserves the link:

```bash
node <skill-dir>/scripts/publish.mjs \
  ./artifact.html --title "Architecture proposal" \
  --id 00000000-0000-0000-0000-000000000000
```

Use `--environment <name>` only when a non-default environment is already present in the config file.

## Authoring contract

Create expressive static pages with:

- semantic HTML and embedded `<style>` blocks;
- responsive layouts, cards, tables, callouts, timelines, and diagrams;
- inline SVG using local fragment references only;
- CSS transitions, animations, media queries, container queries, and keyframes;
- embedded raster images as `data:image/png`, `jpeg`, `webp`, or `gif` URLs;
- HTTPS links;
- code in `<pre><code class="language-typescript">...</code></pre>`.

Available code languages are `bash`, `css`, `diff`, `html`, `javascript`, `json`, `jsx`, `markdown`, `python`, `sql`, `tsx`, `typescript`, and `yaml`, including their common short aliases. The server applies syntax highlighting during publication.

Use the server-provided design tokens where useful:

```css
var(--artifact-bg)
var(--artifact-surface)
var(--artifact-panel)
var(--artifact-border)
var(--artifact-text)
var(--artifact-muted)
var(--artifact-bright)
var(--artifact-accent)
var(--artifact-link)
var(--artifact-warning)
```

The source may use `<html>`, `<head>`, `<title>`, `<style>`, and `<body>`, but omit `<meta>` and `<link>` because the server supplies the final document wrapper and security policy.

Never add scripts, event-handler attributes, iframes, forms, custom elements, remote images, external stylesheets, web fonts, fetches, arbitrary CDN plugins, SVG animation/filter elements, or CSS URLs. The document must remain useful with JavaScript completely disabled.

## Login and credentials

The upload token lives only in `~/.config/the-chatbot/config.json`, outside the skill so that updating the skill never deletes it. That private file is the sole source of endpoint and upload credentials: `scripts/publish.mjs` reads the selected environment from it and binds the credential to that environment's base URL. Never add an arbitrary URL override or an environment-variable credential fallback.

When the user asks to log in, or the configuration is missing, invalid or answers `401`:

1. Ask the user to open the Artifacts page of their The Chatbot, create or rotate the upload token, press the copy button beside the configuration, and tell you when that is done.
2. Run `node <skill-dir>/scripts/login.mjs`. It takes the copied configuration from the clipboard, checks it, and saves it with private permissions, keeping any environment already saved.
3. Report the environment and server it prints.

The token must never pass through you. Do not read the clipboard yourself, open the configuration file, or ask the user to paste the token into the conversation, and do not create, rotate, retrieve, print, quote, copy, or expose it. If `login.mjs` cannot read the clipboard, tell the user to save the copied configuration at that path themselves, with mode `600`. Do not attempt another authentication or configuration flow.

Treat `401` as an invalid or revoked token, `404` on update as an unknown or non-owned artifact, and `422` as authoring violations to repair. Do not retry other failures blindly.

Use `--dry-run` to validate arguments and inspect the intended environment, method, endpoint, title, visibility, and source size without sending a request or printing a credential.
