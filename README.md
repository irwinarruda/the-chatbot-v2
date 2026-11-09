<p align="center">
  <img src="public/brand/logo-dark.svg#gh-dark-mode-only" alt="The Chatbot" width="360">
  <img src="public/brand/logo-light.svg#gh-light-mode-only" alt="The Chatbot" width="360">
</p>

<h3 align="center">A personal AI assistant on WhatsApp and the web.<br>Chat, todos, notes and money, in one place.</h3>

<p align="center">
  <a href="https://github.com/irwinarruda/the-chatbot-v2/actions/workflows/ci.yaml"><img src="https://img.shields.io/github/actions/workflow/status/irwinarruda/the-chatbot-v2/ci.yaml?branch=main&label=CI&labelColor=0B0E11" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-B64D3F?labelColor=0B0E11" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/WhatsApp%20%C2%B7%20Web-E6EAEF?labelColor=0B0E11" alt="WhatsApp and the web">
</p>

<p align="center">
  <a href="#what-it-does">What it does</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#running-locally">Run it</a> ·
  <a href="#ai-models-and-credentials">AI models</a> ·
  <a href="#status">Status</a>
</p>

<p align="center">
  <img src="docs/assets/home-dark.png#gh-dark-mode-only" alt="The Chatbot home page in Barro Slate, the dark theme: an app window whose title bar holds every workspace as a tab, and a Today row with pending tasks, money left to pay, net balance and notes" width="900">
  <img src="docs/assets/home-light.png#gh-light-mode-only" alt="The Chatbot home page in Barro Kaolin, the light theme: an app window whose title bar holds every workspace as a tab, and a Today row with pending tasks, money left to pay, net balance and notes" width="900">
</p>

The Chatbot is a personal assistant, not a SaaS. It started as a small bridge between WhatsApp and a Google Sheet: send a message, log an expense. It grew into one app with two front doors, WhatsApp and the web, and the same core behind both.

Built for one user. Reviewed by the same user. Maintained, hopefully, by him too.

## What it does

| Workspace | What it does |
| --- | --- |
| **AI Chat** | Text and voice conversations, live activity over SSE, a model and reasoning effort you pick at runtime, and tools that act on the other workspaces. |
| **Todos** | Capture tasks from chat or the web, give them due dates, filter the queue and track what is done. |
| **Markdown Notes** | Portable notes you edit and preview in Markdown. AI can refine a draft, and nothing is saved until you say so. |
| **Cash Flow** | Balances and transactions, new entries and transfers between accounts, with real bank balances synced through Google Sheets. |
| **Monthly Bills** | A recurring checklist with progress by count and value, payments marked from chat or the web, and the history kept. |

Google sign-in guards the web workspaces and brings you back to the page you asked for. The web app puts every workspace in one window with tabs at the top, a bottom sheet on phones, in Portuguese or English.

<p align="center">
  <img src="docs/assets/chat.png" alt="The web chat: the assistant adds todos through a tool, answers a spending question, and offers buttons to mark a bill as paid" width="760">
  <br>
  <sub><em>Web chat and WhatsApp reach the same tools and the same conversation.</em></sub>
</p>

| Todos | Notes |
| --- | --- |
| <img src="docs/assets/todos.png" alt="Pending todos sorted by urgency, with overdue and due-today labels, filters and a new task button" width="380"> | <img src="docs/assets/notes.png" alt="The notes index with three Markdown notes and their previews" width="380"> |
| **Cash flow** | **Monthly bills (light)** |
| <img src="docs/assets/cash-flow.png" alt="Net balance with this month's in and out, account balances, search and the latest transactions from the finance spreadsheet" width="380"> | <img src="docs/assets/bills.png" alt="November's bills: money left to pay, progress, totals and the checklist with due-in labels and Pay buttons, in Barro Kaolin, the light theme" width="380"> |

Every picture here comes from `bun run screenshots`, which runs the web app on demo data and retakes them all at once. See `.agents/skills/readme-screenshots`.

### Why it exists

The bot is the way in; the personal platform behind it is the point. It favors small automations that take friction out of real life:

- send a WhatsApp message instead of opening a finance spreadsheet
- turn voice into a conversation or a task
- keep notes in a format that stays portable
- see tasks, balances, transactions and bills without asking the model to rebuild them
- let the assistant use those same capabilities through explicit tools

The first version was written in C# and .NET 9 ([irwinarruda/the-chatbot](https://github.com/irwinarruda/the-chatbot)). This TypeScript rewrite keeps the same discipline and puts the server, the web app, the scripts and the shared contracts in one codebase.

## How it works

The layout follows [favo-cli](https://github.com/irwinarruda/favo-cli): a pure core shared by both sides, a backend split into modules, and an MVVM web client. `tests/architecture.test.ts` enforces it, and the skills in `.agents/skills` explain it.

```text
WhatsApp webhook        TanStack web app
        │                      │
        ▼                      ▼
   controllers / AI tools   screens → Zustand services → repositories
        │                                              │
        ▼                                              ▼
     services ─── domain entities           HTTP, parsed by shared contracts
        │
   ┌────┴─────┐
   ▼          ▼
repositories  gateways
   │          │
   ▼          ▼
PostgreSQL   Google / Meta / Pi / OpenAI / R2
```

- **The domain is pure.** Entities own their rules and transitions, and import nothing but zod and uuid.
- **Contracts are the shared language.** Zod schemas for every HTTP payload, SSE event and AI tool input, parsed on both sides.
- **Services hold the rules; repositories hold the SQL.** A service never runs a query or reads the environment.
- **Gateways wrap everything external.** Every provider has an interface, a real implementation and a test double side by side.
- **Modules import downward.** `system` → `identity` → `chat` → `accounts`, `artifacts`, `cash-flow`, `notes`, `todos`. A flow that changes two modules lives in the higher one.
- **Wiring is explicit.** `src/server/server.ts` builds every service by hand from the gateways it gets; `src/server/production.ts` builds the real ones and is the only reader of the environment.
- **Both front doors share one core.** WhatsApp and web chat run the same messaging flow; only how the reply is delivered differs.

```text
src/
  domain/<area>/         # Entities, value objects, rules and shared vocabulary
  contracts/
    http/<area>/         # Request, response and event schemas, plus mappers
    tools/<area>/        # AI tool input schemas
  server/
    server.ts            # Composition root
    production.ts        # Real gateways and the environment
    shared/              # Config, database, errors, HTTP middleware
    modules/<module>/    # controllers/ services/ repositories/ gateways/ utils/
  client/
    routes/              # TanStack page routes
    shared/              # Store, theme, shadcn primitives, app shell, i18n
    modules/<module>/    # app/ (services, repositories, gateways), parsers/, screens/, components/
  routes.ts              # URL table for pages and controllers

infra/                   # Migrations and operational scripts
tests/                   # domain/ contracts/ server/ client/ integration/ and architecture.test.ts
```

### Stack

| Area | Choice | Role |
| --- | --- | --- |
| Runtime and package manager | **Bun** | Installs dependencies and runs the TypeScript scripts. |
| Full-stack web | **TanStack Start**, **React 19**, **TanStack Router**, **Vite** | Type-safe routes, server handlers, SSR and the browser UI. |
| Database | **PostgreSQL**, `postgres`, **node-pg-migrate** | Conversation and workspace state, raw tagged-template SQL, reversible migrations. |
| AI runtime | **Pi AI** and **Pi Agent Core** | Provider and model normalization, reasoning settings, streaming and the tool loop. |
| Speech and storage | **OpenAI speech-to-text**, **Cloudflare R2** | Audio transcription and durable media storage. |
| Integrations | **WhatsApp Business Cloud API**, **Google OAuth**, **Google Sheets** | Messaging, sign-in and finance data. |
| Interface | **Tailwind CSS v4**, **shadcn/ui** | A responsive, windowed UI on accessible primitives, in the [Barro theme](https://github.com/irwinarruda/barro-theme), slate with a brick accent, or the optional [Favo theme](https://github.com/irwinarruda/favo-theme), each dark or light. |
| Quality | **TypeScript**, **Biome**, **Vitest** | Static checks, formatting and linting, and layered tests. |

## Running locally

> This is a personal project. Local setup assumes access to its provider credentials and some familiarity with PostgreSQL, Google Cloud, and Meta webhooks.

To look around without any of that, run the web app on demo data. It needs no database, no credentials and no sign-in:

```bash
bun install
bun run dev:mock         # http://localhost:3300
```

### Prerequisites

- Bun 1.3 or newer
- Docker with Docker Compose for local PostgreSQL
- ngrok when receiving WhatsApp webhooks locally
- Google OAuth and Sheets credentials
- WhatsApp Business Cloud API credentials
- credentials for at least one supported Pi model provider
- an S3-compatible bucket for durable audio storage

### First run

```bash
bun install
cp .env .env.development # replace placeholders with development credentials
bun run services:ready
bun run dev              # http://localhost:3000
```

To start Vite and the local WhatsApp tunnel together:

```bash
bun run dev:local
```

### Environment modes

The environment loader always reads `.env` first and then overlays `.env.<mode>`. Supported modes are `development`, `mock`, `test`, `preview`, and `production`; `bun run dev` defaults to `development`, and Vitest defaults to `test`.

Keep real credentials in the ignored mode-specific files. Never add production secrets to `.env` or the repository.

### Common commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the development server on port 3000. |
| `bun run dev:local` | Start the app, local PostgreSQL, seeded access, and ngrok. |
| `bun run build` | Build the production application. |
| `bun run test` | Prepare test PostgreSQL and run the serial Node test suite. |
| `bun run test:ui` | Run the separate jsdom React UI suite. |
| `bun run typecheck` | Run TypeScript without emitting files. |
| `bun run check` | Run Biome formatting and lint checks. |

Migration, credential, provider smoke-test, and production delivery commands remain available in [`package.json`](./package.json) and the project agent instructions; they are intentionally kept out of the everyday setup path.

## AI models and credentials

The chat is not tied to one model. Change the default at runtime from the web controls, or with `/model <model-id>` and `/effort`. Pi routes each request to its provider; the app exposes model IDs that are unique across providers, and keeps conversation state and generation traces in PostgreSQL.

Each user's provider credentials are encrypted before they are stored. OpenAI Codex has its own local login script, and other supported credentials can be imported explicitly. The Pi packages are pinned to the same exact version and should always be upgraded together.

Credential setup, smoke tests and Pi upgrades are maintainer work, documented by the repository's scripts rather than the everyday setup.

## Testing

- The main Vitest suite runs serially, with a 30-second timeout, against a real PostgreSQL test database the project scripts prepare.
- Entity, DTO and provider-independent service tests stay deterministic and free of infrastructure where they can.
- PostgreSQL integration tests own database, migration, transaction, hydration and concurrency behavior.
- UI tests run separately under jsdom with `bun run test:ui`.
- Architecture tests protect module ownership and the direction of dependencies.
- Test gateways keep Google, Meta, storage, speech and AI calls out of ordinary CI runs.

## Status

### Available now

- [x] Text and voice chat on WhatsApp and the web
- [x] Runtime AI provider and model selection, and reasoning effort
- [x] Persisted conversation history, summaries and generation traces
- [x] Cash-flow entries, transfers, transaction history and bank balances
- [x] Recurring monthly bills with progress and payment history
- [x] Todos with due dates, filters, chat tools and source transcripts
- [x] Portable Markdown notes with explicit AI-assisted refinement
- [x] Google-authenticated private web workspaces
- [x] Responsive Portuguese and English web UI

### Next

- [ ] Attach audio files and transcriptions to notes
- [ ] Add reminders and proactive notifications
- [ ] Move spreadsheet-backed finance data toward a database source of truth
- [ ] Replace remaining ad-hoc logs with structured logging and security alerts

## License

[MIT](LICENSE), © 2026 Irwin Arruda.

## More from Irwin

- [favo](https://github.com/irwinarruda/favo-cli): every AI subscription you have, on every computer you own.
- [Favo theme](https://github.com/irwinarruda/favo-theme): a warm theme with the contrast to read code all day.
- [Barro theme](https://github.com/irwinarruda/barro-theme): clay on slate, and the brick in this logo.
- [irwin-ui](https://github.com/irwinarruda/irwin-ui): the design system this app follows, with the rules for color, type and the marks.
