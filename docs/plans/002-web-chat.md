# Plan 002: Web Chat with Google Authentication

## Problem

Users can only interact with the chatbot through WhatsApp. There is no web-based chat interface, no browser authentication mechanism, and no way for users to access their conversation history from a browser. The system has no JWTs, sessions, cookies, or bearer tokens — users are identified solely by WhatsApp phone numbers.

## Goal

Add a production-grade web chat interface with Google OAuth authentication. Web users must already exist in the system (registered via WhatsApp first). Web and WhatsApp chats are **interoperable** — one chat per phone number, shared across both providers. The web UI follows the existing terminal aesthetic design system.

## Architecture Overview

### Authentication Flow

```
Browser → GET /api/v1/web/auth/login → Redirect to Google OAuth
Google  → GET /api/v1/web/auth/redirect → Exchange code → Lookup user by email → Sign JWT → Set HttpOnly cookie
Browser → GET /api/v1/web/auth/me → Verify JWT → Return user info
```

### Messaging Flow (Interoperable)

```
Web POST /api/v1/web/messages
  → requireWebAuth() → user from JWT cookie
  → MessagingService.listenToMessage(dto) ← same pipeline as WhatsApp
    → chat lookup by phone_number (shared chat)
    → persist message
    → Mediator.send("RespondToMessage", { chat, message, chatType: "web" })
      → respondToMessage(chat, message, chatType)
        → getMessagingGatewayByChatType(chatType) → WebMessagingGateway
        → gateway.sendTextMessage() → enqueue to user's SSE channel

Web GET /api/v1/web/stream
  → requireWebAuth() → user from JWT cookie
  → WebMessagingGateway.subscribe(phoneNumber) → AsyncGenerator → SSE
```

### Gateway Hierarchy

```
IMessagingGateway (base — existing)
  ├── IWhatsAppMessagingGateway extends IMessagingGateway (existing)
  └── IWebMessagingGateway extends IMessagingGateway (new)
        enqueue(phoneNumber, event)
        subscribe(phoneNumber) → AsyncGenerator
```

### Interoperable Chat Model

```
Chat (one per phone_number)
  ├── Messages from WhatsApp (chatType in DTO, not stored on chat)
  └── Messages from Web (chatType in DTO, not stored on chat)

chat.type = origin provider (set once on creation, never changes)
chatType in DTO/event = routing info for gateway dispatch
```

## Decisions Log

| Decision             | Choice                                   | Rationale                                                          |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Web users            | Must exist via WhatsApp first            | Simplifies auth — no user creation from web                        |
| User identification  | Email lookup → phone number → chat       | Google OAuth provides email; user already has phone                |
| Chat model           | One chat per phone number, shared        | Interoperable — web and WhatsApp see same history                  |
| `chat.type`          | Informational only, set once on creation | Records origin provider, never changes                             |
| Gateway dispatch     | `chatType` param on `respondToMessage`   | Decoupled from `chat.type`; DTO carries routing info               |
| `ChatType.Web`       | Added to enum for DTO routing only       | NOT used for `chat.type` storage                                   |
| Session mechanism    | JWT in HttpOnly cookie via `jose`        | No existing auth infrastructure; simple, stateless                 |
| Google OAuth         | Separate `webRedirectUri`                | Different callback URL from WhatsApp flow                          |
| Real-time            | SSE (same pattern as TUI)                | Proven pattern; `TuiWhatsAppMessagingGateway` as template          |
| Audio visualization  | `wavesurfer.js` + `@wavesurfer/react`    | Beautiful waveform display, not plain `<audio>`                    |
| AuthService refactor | Break into reusable private methods      | Web auth reuses `exchangeAndGetUserInfo` without credential saving |
| Enum imports         | Import directly from `~/entities/enums/` | No re-exports; consistent with codebase convention                 |
| Migration files      | `bun run migrate:create -- <name>`       | Use tooling, not manual file creation                              |
| Email on users       | Add `email VARCHAR(255)` column          | Google OAuth provides email; needed for web user lookup            |

## Implementation Steps

### Step 1: Migration — Add `email` Column to Users

**File:** `infra/migrations/1776038219244_update-user-with-email.js` (already created)

```js
export function up(pgm) {
  pgm.sql(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
}

export function down(pgm) {
  pgm.sql(`ALTER TABLE users DROP COLUMN email`);
}
```

Nullable — existing WhatsApp-only users won't have email until they authenticate via web.

### Step 2: Update `User` Entity

**File:** `src/entities/User.ts`

Add `email` field:

```typescript
email: string | null;
```

Update `fromRow()` / `create()` / `toRow()` to handle the new column.

### Step 3: Add `ChatType.Web` to Enum

**File:** `src/entities/enums/ChatType.ts`

```typescript
export const ChatType = {
  WhatsApp: "wa_biz",
  Web: "web",
} as const;
export type ChatType = ValueOf<typeof ChatType>;
```

This value is used for DTO routing only. Existing chats created from WhatsApp keep `chat.type = "wa_biz"`. New chats created from web would get `chat.type = "web"`, but since web users must have registered via WhatsApp first, their chat already exists.

### Step 4: Update Config — JWT Secret + Web Redirect URI

**File:** `infra/config.ts`

Add to `googleConfigSchema`:

```typescript
webRedirectUri: z.string().default(""),
webLoginUri: z.string().default(""),
```

Add new top-level config:

```typescript
export const jwtConfigSchema = z.object({
  secret: z.string().min(1),
  expiresIn: z.string().default("7d"),
});
```

Add `jwt: jwtConfigSchema` to `configSchema`. Map from `JWT_SECRET` and `JWT_EXPIRES_IN` env vars.

### Step 5: Create JWT Utilities

**New file:** `infra/jwt.ts`

Uses `jose` library:

```typescript
import * as jose from "jose";

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: string,
): Promise<string>;

export async function verifyJwt<T>(token: string, secret: string): Promise<T>;
```

### Step 6: Create Web Auth Helpers

**New file:** `infra/web.ts`

Pattern follows `infra/tui.ts`:

```typescript
import type { Config } from "~/infra/config";

export function requireWebAuth(
  request: Request,
  config: Config,
): Promise<{ userId: string; email: string; phoneNumber: string }>;

export function setAuthCookie(response: Headers, token: string): void;

export function clearAuthCookie(response: Headers): void;
```

`requireWebAuth` extracts JWT from cookie, verifies it, returns user info. Throws `UnauthorizedException` on failure.

### Step 7: Refactor `AuthService` — Reusable Private Methods

**File:** `src/services/AuthService.ts`

Break `saveUserByGoogleCredential` into reusable private methods:

```typescript
// Existing method, refactored:
async saveUserByGoogleCredential(code: string, encryptedState: string): Promise<void> {
  const { phoneNumber, chatPhoneNumber } = this.decryptAndParseState(encryptedState);
  const userInfo = await this.exchangeCodeAndGetUserInfo(code);
  const user = await this.findOrCreateUser(phoneNumber);
  await this.upsertGoogleCredential(user, userInfo);
  // ... mediator event
}

// New private methods:
private async exchangeCodeAndGetUserInfo(
  code: string,
  variant: "whatsapp" | "web" = "whatsapp",
): Promise<GoogleUserInfo>;

private async findOrCreateUser(phoneNumber: string): Promise<User>;

private async upsertGoogleCredential(
  user: User,
  userInfo: GoogleUserInfo,
): Promise<void>;

// New public method for web auth:
async getUserByEmail(email: string): Promise<User | null>;

// Persist email when available:
// In findOrCreateUser or upsertGoogleCredential, save email to user if not already set

// New public method:
async handleWebGoogleRedirect(code: string): Promise<User> {
  const userInfo = await this.exchangeCodeAndGetUserInfo(code, "web");
  const user = await this.getUserByEmail(userInfo.email);
  if (!user) throw new UnauthorizedException("User not registered");
  // Update email on user if not set
  return user;
}
```

Also: when `saveUserByGoogleCredential` runs (WhatsApp flow), persist the email from Google userinfo to the user record.

### Step 8: Update `IGoogleAuthGateway` + Implementations

**File:** `src/resources/IGoogleAuthGateway.ts`

Add web-specific methods:

```typescript
createWebAuthorizationCodeUrl(state?: string): string;
exchangeWebCodeForTokens(code: string): Promise<Credentials>;
```

**File:** `src/resources/GoogleAuthGateway.ts`

Create a second OAuth2 client using `config.google.webRedirectUri`. Implement web methods using this client.

**File:** `src/resources/TestGoogleAuthGateway.ts`

Add stub implementations.

### Step 9: Create `IWebMessagingGateway` + Implementations

**New file:** `src/resources/IWebMessagingGateway.ts`

```typescript
import type { IMessagingGateway } from "~/resources/IMessagingGateway";

export interface IWebMessagingGateway extends IMessagingGateway {
  enqueue(phoneNumber: string, event: WebChatEvent): void;
  subscribe(phoneNumber: string): AsyncGenerator<WebChatEvent>;
}

export type WebChatEvent = {
  type: "text" | "interactive_button" | "audio" | "error";
  data: unknown;
};
```

**New file:** `src/resources/WebMessagingGateway.ts`

Multi-tenant channels pattern (based on `TuiWhatsAppMessagingGateway`):

```typescript
export class WebMessagingGateway implements IWebMessagingGateway {
  private channels = new Map<string, WebChatEvent[]>();
  private waiters = new Map<string, ((event: WebChatEvent) => void)>();

  // IMessagingGateway methods — enqueue events instead of HTTP calls
  async sendTextMessage(dto: SendTextMessageDTO): Promise<void> {
    this.enqueue(dto.phoneNumber, { type: "text", data: dto });
  }
  async sendInteractiveReplyButtonMessage(dto: SendInteractiveButtonMessageDTO): Promise<void> {
    this.enqueue(dto.phoneNumber, { type: "interactive_button", data: dto });
  }
  async downloadMediaAsync(mediaId: string): Promise<Buffer> {
    // Web audio is uploaded directly as buffer — return from temp storage
  }

  // Web-specific methods
  enqueue(phoneNumber: string, event: WebChatEvent): void { ... }
  async *subscribe(phoneNumber: string): AsyncGenerator<WebChatEvent> { ... }
}
```

**New file:** `src/resources/TestWebMessagingGateway.ts`

Test double with in-memory storage.

### Step 10: Update `MessagingService` — `chatType` Routing

**File:** `src/services/MessagingService.ts`

**Constructor:** Add `webMessagingGateway: IMessagingGateway` parameter.

**`getMessagingGatewayByChatType`:** Add `ChatType.Web` case.

**`respondToMessage`:** Change signature to accept `chatType` parameter:

```typescript
async respondToMessage(
  chat: Chat,
  message: Message,
  chatType: ChatType,
): Promise<void> {
  const gateway = this.getMessagingGatewayByChatType(chatType);
  // ... rest uses gateway
}
```

**`RespondToMessageEvent`:** Include `chatType`:

```typescript
type RespondToMessageEvent = {
  chat: Chat;
  message: Message;
  chatType: ChatType;
};
```

**`listenToMessage`:** Pass `dto.chatType` through mediator event:

```typescript
this.mediator.send("RespondToMessage", {
  chat,
  message,
  chatType: dto.chatType,
});
```

**Mediator handler** in bootstrap: Extract `chatType` from event and pass to `respondToMessage`.

### Step 11: Update Bootstrap + Test Orchestrator

**File:** `infra/bootstrap.ts`

- Register `IWebMessagingGateway` → `WebMessagingGateway` (singleton)
- Pass `webMessagingGateway` to `MessagingService` constructor
- Update mediator `"RespondToMessage"` handler to pass `chatType`

**File:** `tests/orquestrator.ts`

- Register `IWebMessagingGateway` → `TestWebMessagingGateway`
- Update `MessagingService` wiring

### Step 12: Web Auth Routes

**New file:** `src/routes/api/v1/web/auth/login.tsx`

```
GET /api/v1/web/auth/login
  → Build Google OAuth URL with webRedirectUri
  → Redirect browser to Google
```

**New file:** `src/routes/api/v1/web/auth/redirect.tsx`

```
GET /api/v1/web/auth/redirect?code=...
  → authService.handleWebGoogleRedirect(code)
  → Sign JWT with { userId, email, phoneNumber }
  → Set HttpOnly cookie
  → Redirect to /chat
```

**New file:** `src/routes/api/v1/web/auth/me.tsx`

```
GET /api/v1/web/auth/me
  → requireWebAuth()
  → Return user info JSON
```

**New file:** `src/routes/api/v1/web/auth/logout.tsx`

```
POST /api/v1/web/auth/logout
  → clearAuthCookie()
  → Return 200
```

### Step 13: Web Messaging Routes

**New file:** `src/routes/api/v1/web/messages.tsx`

```
GET /api/v1/web/messages
  → requireWebAuth()
  → Fetch chat by phone number
  → Return message history (including WhatsApp messages)

POST /api/v1/web/messages
  → requireWebAuth()
  → Build ReceiveTextMessageDTO or ReceiveInteractiveButtonMessageDTO
    with chatType: ChatType.Web
  → messagingService.listenToMessage(dto)
  → Return 200
```

**New file:** `src/routes/api/v1/web/audio.tsx`

```
POST /api/v1/web/audio
  → requireWebAuth()
  → Accept audio blob from browser MediaRecorder
  → Build ReceiveAudioMessageDTO with chatType: ChatType.Web
  → Store audio buffer for downloadMediaAsync
  → messagingService.listenToMessage(dto)
  → Return 200
```

**New file:** `src/routes/api/v1/web/stream.tsx`

Pattern follows `src/routes/api/v1/tui/stream.tsx`:

```
GET /api/v1/web/stream
  → requireWebAuth()
  → webMessagingGateway.subscribe(phoneNumber)
  → Stream SSE events to browser
```

### Step 14: Chat Page Route + Components

**New file:** `src/routes/chat.tsx`

TanStack route for `/chat`. Checks auth on load (calls `/api/v1/web/auth/me`). Redirects to login if not authenticated. Redirects to `/chat/not-registered` if user not found.

**New file:** `src/routes/chat/not-registered.tsx`

Simple page: "You need to register via WhatsApp first."

**New file:** `src/components/pages/ChatPage.tsx`

Full chat UI following the terminal aesthetic design system (`docs/STYLES.md`):

- Message list with auto-scroll
- Text input with send button
- Audio recording with browser `MediaRecorder`
- Audio playback with `wavesurfer.js` + `@wavesurfer/react` waveform visualization
- Button reply rendering (interactive buttons from AI)
- SSE connection via custom `useSSE` hook (adapted from `cli/src/hooks/useSSE.ts`)
- Loading states, error handling
- Responsive layout

**New file:** `src/components/pages/ChatPage.css`

Styles using existing `--term-*` CSS custom properties. Terminal aesthetic.

### Step 15: Update `PublicPages` + i18n

**File:** `src/components/pages/PublicPages.tsx`

Add navigation link to `/chat` in the terminal window header/nav.

**File:** `src/i18n/en.json` + `src/i18n/pt-BR.json`

Add translations for:

- Chat page title, placeholder text, send button
- Audio recording states
- Error messages
- Not registered page
- Navigation label

### Step 16: Install Dependencies

**File:** `package.json`

```
bun add jose wavesurfer.js @wavesurfer/react
```

### Step 17: Environment Variables

Add to `.env` (template):

```
JWT_SECRET=
JWT_EXPIRES_IN=7d
GOOGLE_WEB_REDIRECT_URI=
GOOGLE_WEB_LOGIN_URI=
```

Add actual values to `.env.local`, `.env.development`, etc.

## Files Summary

### New Files (17)

| File                                       | Purpose                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `infra/jwt.ts`                             | JWT sign/verify utilities using `jose`             |
| `infra/web.ts`                             | Web auth helpers (requireWebAuth, cookies)         |
| `src/resources/IWebMessagingGateway.ts`    | Web gateway interface                              |
| `src/resources/WebMessagingGateway.ts`     | Production web gateway (multi-tenant SSE channels) |
| `src/resources/TestWebMessagingGateway.ts` | Test web gateway                                   |
| `src/routes/api/v1/web/auth/login.tsx`     | Google OAuth redirect                              |
| `src/routes/api/v1/web/auth/redirect.tsx`  | OAuth redirect + JWT cookie                        |
| `src/routes/api/v1/web/auth/me.tsx`        | Current user endpoint                              |
| `src/routes/api/v1/web/auth/logout.tsx`    | Clear session                                      |
| `src/routes/api/v1/web/messages.tsx`       | Send message + GET chat history                    |
| `src/routes/api/v1/web/audio.tsx`          | Send audio message                                 |
| `src/routes/api/v1/web/stream.tsx`         | SSE stream                                         |
| `src/routes/chat.tsx`                      | Chat page route                                    |
| `src/routes/chat/not-registered.tsx`       | Not registered page                                |
| `src/components/pages/ChatPage.tsx`        | Chat UI with wavesurfer.js audio                   |
| `src/components/pages/ChatPage.css`        | Chat styles (terminal aesthetic)                   |

### Modified Files (14)

| File                                     | Changes                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/entities/User.ts`                   | Add `email` field                                                                             |
| `src/entities/enums/ChatType.ts`         | Add `Web: "web"`                                                                              |
| `src/services/AuthService.ts`            | Refactor into private methods, add `handleWebGoogleRedirect`, `getUserByEmail`, persist email |
| `src/services/MessagingService.ts`       | Add `webMessagingGateway`, `respondToMessage` takes `chatType`, update mediator event         |
| `src/resources/IGoogleAuthGateway.ts`    | Add `createWebAuthorizationCodeUrl`, `exchangeWebCodeForTokens`                               |
| `src/resources/GoogleAuthGateway.ts`     | Web OAuth client + implementations                                                            |
| `src/resources/TestGoogleAuthGateway.ts` | Stub web auth methods                                                                         |
| `infra/config.ts`                        | Add `jwt` config, `webRedirectUri`, `webLoginUri`                                             |
| `infra/bootstrap.ts`                     | Register `IWebMessagingGateway`, update `MessagingService`, update mediator for `chatType`    |
| `tests/orquestrator.ts`                  | Register `TestWebMessagingGateway`, update `MessagingService`                                 |
| `src/i18n/en.json`                       | Chat page translations                                                                        |
| `src/i18n/pt-BR.json`                    | Chat page translations                                                                        |
| `src/components/pages/PublicPages.tsx`   | Add chat nav link                                                                             |
| `package.json`                           | Add `jose`, `wavesurfer.js`, `@wavesurfer/react`                                              |

### Migration

| File                                                       | SQL                                               |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `infra/migrations/1776038219244_update-user-with-email.js` | `ALTER TABLE users ADD COLUMN email VARCHAR(255)` |

## Message Flow (After Implementation)

### WhatsApp → Shared Chat

```
WhatsApp webhook → MessagingService.receiveWhatsAppMessage()
  → dto.chatType = ChatType.WhatsApp
  → listenToMessage(dto)
    → getChatByPhoneNumber() → existing chat
    → persist message
    → Mediator: { chat, message, chatType: ChatType.WhatsApp }
      → respondToMessage(chat, message, ChatType.WhatsApp)
        → WhatsAppMessagingGateway.sendTextMessage()
```

### Web → Same Shared Chat

```
POST /api/v1/web/messages → requireWebAuth() → user
  → dto.chatType = ChatType.Web
  → listenToMessage(dto)
    → getChatByPhoneNumber() → SAME chat as WhatsApp
    → persist message (appears in shared history)
    → Mediator: { chat, message, chatType: ChatType.Web }
      → respondToMessage(chat, message, ChatType.Web)
        → WebMessagingGateway.sendTextMessage() → SSE to browser
```

### Web → View Full History

```
GET /api/v1/web/messages → requireWebAuth() → user
  → getChatByPhoneNumber()
  → getMessagesByChat() → ALL messages (WhatsApp + Web)
  → Return to browser
```

## Risks / Flagged for Later

- **Email uniqueness** — `email` column is not UNIQUE. Multiple users could theoretically share an email. `getUserByEmail` returns first match. Consider adding unique constraint later.
- **Concurrent gateway responses** — If user sends from both WhatsApp and web simultaneously, AI might respond to both. The shared chat means message history is consistent, but both gateways fire. Acceptable for now.
- **Audio storage for web** — Web audio uploads need a mechanism for `downloadMediaAsync` to retrieve the buffer. Options: temp in-memory map keyed by generated mediaId, or direct buffer pass. Implementation detail.
- **No user creation from web** — If a user has never interacted via WhatsApp, they cannot use web chat. This is by design but may need revisiting.
- **`chat.type` semantics** — For interoperable chats, `chat.type` records the origin provider. A chat created via WhatsApp stays `wa_biz` even when the user chats from web. This is intentional — `chatType` in the DTO handles routing.

## UI

- Create a beautiful web chat interface following the terminal aesthetic design system. Use `wavesurfer.js` for audio visualization. Ensure responsive design and good UX.

## Implementation Checklist

- [x] **Step 1** — Run migration: add `email VARCHAR(255)` column to `users` table
- [x] **Step 2** — Update `User` entity: add `email` field, update `fromRow()` / `create()` / `toRow()`
- [x] **Step 3** — Add `ChatType.Web = "web"` to `src/entities/enums/ChatType.ts`
- [x] **Step 4** — Update `infra/config.ts`: add `jwt` config schema, `webRedirectUri`, `webLoginUri`
- [x] **Step 5** — Create `infra/jwt.ts`: `signJwt` and `verifyJwt` utilities using `jose`
- [x] **Step 6** — Create `infra/web.ts`: `requireWebAuth`, `setAuthCookie`, `clearAuthCookie`
- [x] **Step 7** — Refactor `AuthService`: extract private methods, add `handleWebGoogleRedirect`, `getUserByEmail`, persist email on WhatsApp flow
- [x] **Step 8** — Update `IGoogleAuthGateway` + `GoogleAuthGateway` + `TestGoogleAuthGateway`: add web OAuth client and methods
- [x] **Step 9** — Create `IWebMessagingGateway`, `WebMessagingGateway`, and `TestWebMessagingGateway`
- [x] **Step 10** — Update `MessagingService`: add `webMessagingGateway`, add `chatType` param to `respondToMessage`, update `RespondToMessageEvent`
- [x] **Step 11** — Update `infra/bootstrap.ts` and `tests/orquestrator.ts`: register web gateway, update `MessagingService` wiring and mediator handler
- [x] **Step 12** — Create web auth routes: `login.tsx`, `redirect.tsx`, `me.tsx`, `logout.tsx`
- [x] **Step 13** — Create web messaging routes: `messages.tsx`, `audio.tsx`, `stream.tsx`
- [x] **Step 14** — Create `src/routes/chat.tsx`, `src/routes/chat/not-registered.tsx`, `ChatPage.tsx`, `ChatPage.css`
- [x] **Step 15** — Update `PublicPages.tsx` and i18n files (`en.json`, `pt-BR.json`) with chat translations
- [x] **Step 16** — Install dependencies: `bun add jose wavesurfer.js @wavesurfer/react`
- [x] **Step 17** — Add env vars to `.env`: `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_WEB_REDIRECT_URI`, `GOOGLE_WEB_LOGIN_URI`
