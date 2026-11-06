<div align="center">
  <img src="public/logo.svg" alt="The Chatbot logo" height="120" />
  <h1>The Chatbot</h1>
  <p><em>A personal AI workspace across WhatsApp and the web.</em></p>
  <p>
    <code>AI Chat</code> &middot;
    <code>Todos</code> &middot;
    <code>Markdown Notes</code> &middot;
    <code>Cash Flow</code> &middot;
    <code>Monthly Bills</code>
  </p>
</div>

---

> One assistant for conversations, tasks, notes, and personal finances.

<p align="center">
  <img src="docs/assets/home-honey.png#gh-dark-mode-only" alt="The Chatbot home page in the Favo Honey theme: an app window whose title bar holds every workspace as a tab, and a Today row with pending tasks, money left to pay, net balance and notes" width="900" />
  <img src="docs/assets/home-wax.png#gh-light-mode-only" alt="The Chatbot home page in the Favo Wax theme: an app window whose title bar holds every workspace as a tab, and a Today row with pending tasks, money left to pay, net balance and notes" width="900" />
</p>

## What it is

The Chatbot is a **personal-use assistant**, not a SaaS. It started as a small bridge between WhatsApp and a Google Sheet: send a message, log an expense. It has grown into a compact personal operating surface with two front doors and one application core.

| Workspace | What it does |
| --- | --- |
| **AI Chat** | Text and voice conversations, live activity over SSE, runtime model selection, reasoning-effort controls, and tools that act on the other workspaces. |
| **Todos** | Capture tasks from chat or the web, assign due dates, filter the queue, and track completion. |
| **Markdown Notes** | Create durable, portable notes; edit and preview Markdown; refine a draft with AI before explicitly saving it. |
| **Cash Flow** | Review balances and transactions, add entries, transfer between accounts, and synchronize real bank balances with Google Sheets. |
| **Monthly Bills** | Maintain a recurring checklist, follow monthly progress by count and value, mark payments from chat or the web, and preserve history. |

Google sign-in protects the private web workspaces and returns the user to the exact page they originally requested. The interface is responsive, puts every workspace in one app window with top-level tabs (a bottom sheet on phones), and is available in Portuguese and English.

## Why it exists

The bot is the entry point; the reusable personal platform behind it is the point. The project favors small automations that remove friction from real life:

- send a WhatsApp message instead of opening a finance spreadsheet
- turn voice into a useful conversation or task
- keep personal notes in a format that remains portable
- see tasks, balances, transactions, and bills without asking the model to reconstruct state
- let the assistant use those same capabilities through explicit application tools

The first version was written in **C# / .NET 9** ([irwinarruda/the-chatbot](https://github.com/irwinarruda/the-chatbot)). The TypeScript rewrite keeps the same practical discipline while putting the server, web app, scripts, and shared contracts in one codebase.

## Architecture

The application follows the layout of [favo-cli](https://github.com/irwinarruda/favo-cli): a pure core shared by both sides, a layered backend split into modules, and an MVVM web client. `tests/architecture.test.ts` enforces it, and the skills in `.agents/skills` explain it.

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

- **The domain is pure.** Entities own invariants and transitions and import nothing but zod and uuid.
- **Contracts are the shared language.** Zod schemas for every HTTP payload, SSE event and AI tool input, parsed on both sides.
- **Services hold the rules; repositories hold the SQL.** A service never runs a query or reads the environment.
- **Gateways isolate external systems.** Every provider has an interface, a real implementation and a test double side by side.
- **Modules import downward.** `system` → `identity` → `chat` → `accounts`, `artifacts`, `cash-flow`, `notes`, `todos`. A flow that changes two modules lives in the higher one.
- **Composition is explicit.** `src/server/server.ts` wires every service by hand from the gateways it receives; `src/server/production.ts` builds the real ones and is the only reader of the environment.
- **Both interfaces share the same core.** WhatsApp and web chat enter the same messaging workflow; only their delivery gateways differ.

### Repository shape

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

<p align="center">
  <img src="docs/assets/chat.png" alt="The web chat: the assistant adds todos through a tool, answers a spending question, and offers buttons to mark a bill as paid" width="760" />
  <br />
  <sub><em>Web chat and WhatsApp reach the same application tools and persisted conversation state.</em></sub>
</p>

| Todos | Notes |
| --- | --- |
| <img src="docs/assets/todos.png" alt="Pending todos sorted by urgency, with overdue and due-today labels, filters and a new task button" width="380" /> | <img src="docs/assets/notes.png" alt="The notes index with three Markdown notes and their previews" width="380" /> |
| **Cash flow** | **Monthly bills (Wax)** |
| <img src="docs/assets/cash-flow.png" alt="Net balance with this month's in and out, account balances, search and the latest transactions from the finance spreadsheet" width="380" /> | <img src="docs/assets/bills.png" alt="November's bills: money left to pay, progress, totals and the checklist with due-in labels and Pay buttons, in the light theme" width="380" /> |

Every picture above comes from `bun run screenshots`, which runs the web app on demo data (`bun run dev:mock`) and retakes them in one go. See `.agents/skills/readme-screenshots`.

## Stack

| Area | Choice | Role |
| --- | --- | --- |
| Runtime and package manager | **Bun** | Installs dependencies and runs the TypeScript scripts. |
| Full-stack web | **TanStack Start**, **React 19**, **TanStack Router**, **Vite** | Type-safe routes, server handlers, SSR, and the browser UI. |
| Database | **PostgreSQL**, `postgres`, **node-pg-migrate** | Conversation and workspace state, raw tagged-template SQL, reversible migrations. |
| AI runtime | **Pi AI** + **Pi Agent Core** | Provider/model normalization, reasoning configuration, streaming, and the tool loop. |
| Speech and storage | **OpenAI speech-to-text**, **Cloudflare R2** | Audio transcription and durable media storage. |
| Integrations | **WhatsApp Business Cloud API**, **Google OAuth**, **Google Sheets** | Messaging, authentication, and finance data. |
| Interface | **Tailwind CSS v4**, **shadcn/ui**, [Favo theme](https://github.com/irwinarruda/favo-theme) | Responsive windowed UI in Honey (dark) and Wax (light), on accessible primitives. |
| Quality | **TypeScript**, **Biome**, **Vitest** | Static checking, formatting/linting, and layered tests. |

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

The environment loader always reads `.env` first and then overlays `.env.<mode>`. Supported modes are `development`, `test`, `preview`, and `production`; `bun run dev` defaults to `development`, and Vitest defaults to `test`.

Keep real credentials in the ignored mode-specific files. Never add production secrets to `.env` or the repository.

## Common commands

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

The chat is not tied to one hard-coded model. The configured default can be changed at runtime from the web controls or the `/model <model-id>` and `/effort` commands. Pi owns provider routing while the application exposes globally unique model IDs and keeps conversation state and generation traces in PostgreSQL.

Per-user provider credentials are encrypted before persistence. OpenAI Codex authentication has a dedicated local login script; other supported credentials can be imported explicitly. The Pi packages are pinned to the same exact version and should always be upgraded together.

Provider credential setup, smoke tests, and Pi upgrade validation are maintainer operations documented by the repository scripts rather than part of the everyday setup path.

## Testing

- The main Vitest suite runs serially with a 30-second timeout and prepares a real PostgreSQL test database through the project scripts.
- Entity, DTO, and provider-independent Service tests stay deterministic and infrastructure-free where possible.
- PostgreSQL integration tests own database, migration, transaction, hydration, and concurrency behavior.
- UI tests run separately under jsdom through `bun run test:ui`.
- Architecture tests protect module ownership and dependency direction.
- Test gateways keep Google, Meta, storage, speech, and AI calls out of ordinary CI runs.

## Current status

### Available now

- [x] Text and voice chat on WhatsApp and the web
- [x] Runtime AI provider/model selection and reasoning effort
- [x] Persisted conversation history, summaries, and generation traces
- [x] Cash-flow entries, transfers, transaction history, and bank balances
- [x] Recurring monthly bills with progress and payment history
- [x] Todos with due dates, filters, chat tools, and source transcripts
- [x] Portable Markdown notes with explicit AI-assisted refinement
- [x] Google-authenticated private web workspaces
- [x] Responsive Portuguese and English web UI

### Next

- [ ] Attach audio files and transcriptions to notes
- [ ] Add reminders and proactive notifications
- [ ] Move spreadsheet-backed finance data toward a database source of truth
- [ ] Replace remaining ad-hoc logs with structured logging and security alerts

---

<sub>Built for one user. Reviewed by the same user. Maintained, hopefully, by him too.</sub>
