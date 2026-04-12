# Plan 001: Generic Messaging Gateway (Multi-Provider Support)

## Problem

The system is tightly coupled to WhatsApp as the only messaging provider. `MessagingService` holds a single `IWhatsAppMessagingGateway`, all receive/send flows are WhatsApp-specific, and there is no abstraction for adding new providers (e.g., Web Chat, Telegram).

## Goal

Refactor the messaging layer to support multiple chat providers while keeping phone number as the main user identifier. Follow clean architecture, avoid code duplication, and make adding new providers straightforward.

## Architecture Overview

```
IMessagingGateway (base)
  sendTextMessage(dto)
  sendInteractiveReplyButtonMessage(dto)
  downloadMediaAsync(mediaId)

IWhatsAppMessagingGateway extends IMessagingGateway
  validateSignature(signature, rawBody)
  validateWebhook(hubMode, hubVerifyToken)
  receiveWhatsAppMessage(data)

IWebChatMessagingGateway extends IMessagingGateway (future)
  receiveWebMessage(data)
```

**Responsibility split:**

- **Route/Controller** — Provider-specific. Validates signatures, calls provider-specific receive, then delegates to service.
- **MessagingService** — Provider-agnostic. Works with `IMessagingGateway` instances. Handles receive pipeline (auth, chat lookup, persist, AI response).

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Gateway abstraction | Single base `IMessagingGateway` with provider-specific extensions | Avoids code duplication; service uses base interface only |
| Provider dispatch | Inject individual providers, use `getMessagingGatewayByChatType()` helper | Simpler than a registry map or factory class |
| Receive flow | Provider-specific `receive*Message()` methods (not on base interface) | Each provider has different raw payload parsing |
| Listen flow | Shared `listenToMessage(dto)` — provider-agnostic pipeline | Core business logic is the same regardless of provider |
| DTO contract | Generic DTOs shared across all providers, `chatType` added to `ReceiveMessageDTO` | Each provider normalizes its payload into the same shape |
| User identification | Phone number remains the universal identifier | Web chat will pass phone number; no schema changes needed |
| Chat type on chat | `chat.type` set from `dto.chatType` on creation | Determines which gateway to use for responses |
| Auth confirmations | Always sent via WhatsApp for now | Google auth is initiated from WhatsApp; revisit when web auth exists |
| Enum organization | Move all enums to `src/entities/enums/` as separate files | Enables `ChatType` import in DTOs without circular deps |

## Refactoring Steps

### Step 1: Create `src/entities/enums/` — Extract Enums

Move enums from entity files into separate files:

| New File | Enum | Currently In |
|---|---|---|
| `ChatType.ts` | `ChatType` | `Chat.ts` |
| `MessageType.ts` | `MessageType` | `Message.ts` |
| `MessageUserType.ts` | `MessageUserType` | `Message.ts` |
| `CredentialType.ts` | `CredentialType` | `Credentials.ts` |
| `CashFlowSpreadsheetType.ts` | `CashFlowSpreadsheetType` | `CashFlowSpreadsheet.ts` |

Update all imports across the codebase. Entity files re-export from the new location if needed for backward compatibility.

### Step 2: Create `IMessagingGateway` Base Interface

New file: `src/resources/IMessagingGateway.ts`

Move DTOs here from `IWhatsAppMessagingGateway.ts`:
- `SendTextMessageDTO`
- `SendInteractiveButtonMessageDTO`
- `ReceiveMessageDTO` — add `chatType: ChatType` field
- `ReceiveTextMessageDTO extends ReceiveMessageDTO`
- `ReceiveInteractiveButtonMessageDTO extends ReceiveMessageDTO`
- `ReceiveAudioMessageDTO extends ReceiveMessageDTO`

Base interface:
```typescript
interface IMessagingGateway {
  sendTextMessage(dto: SendTextMessageDTO): Promise<void>;
  sendInteractiveReplyButtonMessage(dto: SendInteractiveButtonMessageDTO): Promise<void>;
  downloadMediaAsync(mediaId: string): Promise<Buffer>;
}
```

Note: `receiveMessage()` is NOT on the base interface — it's provider-specific.

### Step 3: Refactor `IWhatsAppMessagingGateway`

`IWhatsAppMessagingGateway` now extends `IMessagingGateway`:

```typescript
interface IWhatsAppMessagingGateway extends IMessagingGateway {
  validateSignature(signature: string, rawBody: string): boolean;
  validateWebhook(hubMode: string, hubVerifyToken: string): boolean;
  receiveWhatsAppMessage(data: unknown): ReceiveMessageDTO | undefined;
}
```

Removed (now inherited from base): `sendTextMessage`, `sendInteractiveReplyButtonMessage`, `downloadMediaAsync`.
Renamed: `receiveMessage` → `receiveWhatsAppMessage`.

### Step 4: Update `MessagingService`

**Constructor changes:**
- Replace `whatsAppMessagingGateway: IWhatsAppMessagingGateway` with individual `IMessagingGateway` params:
  ```typescript
  constructor(
    ...,
    whatsAppGateway: IMessagingGateway,
    webChatGateway: IMessagingGateway, // future
    ...
  )
  ```
- Add private helper:
  ```typescript
  private getMessagingGatewayByChatType(chatType: ChatType): IMessagingGateway {
    switch (chatType) {
      case ChatType.WhatsApp:
        return this.whatsAppGateway;
      // case ChatType.Web: return this.webChatGateway;
      default:
        throw new ValidationException("Unsupported chat type");
    }
  }
  ```

**Method changes:**

- `receiveMessage(rawBody, signature)` → `receiveWhatsAppMessage(rawBody, signature)`
  - Still validates signature via WhatsApp-specific gateway
  - Calls `receiveWhatsAppMessage(data)` on WhatsApp gateway
  - Calls `listenToMessage(dto)`

- `listenToMessage(dto: ReceiveMessageDTO)` — uses `dto.chatType` to set `chat.type` on new chats

- `respondToMessage(chat, message)`:
  - Resolves gateway via `getMessagingGatewayByChatType(chat.type)`
  - Uses it for `sendTextMessage`, `sendInteractiveReplyButtonMessage`, `downloadMediaAsync`

- `sendTextMessage(phoneNumber, text, chat?)` — resolves gateway via `chat.type` (already fetches chat)
- `sendButtonReplyMessage(phoneNumber, text, options, chat?)` — resolves gateway via `chat.type`
- `validateWebhook(hubMode, hubVerifyToken)` — stays WhatsApp-specific, called from route

### Step 5: Update Route Layer

`src/routes/api/v1/whatsapp/webhook.tsx`:
- `messagingService.receiveMessage(...)` → `messagingService.receiveWhatsAppMessage(...)`

### Step 6: Update Bootstrap

`infra/bootstrap.ts`:
- Keep `IWhatsAppMessagingGateway` registration for route-level WhatsApp-specific access
- Pass individual `IMessagingGateway` instances to `MessagingService` constructor:
  ```typescript
  container.register("MessagingService", () =>
    new MessagingService(
      database,
      container.resolve("AuthService"),
      mediator,
      container.resolve("IWhatsAppMessagingGateway"), // as IMessagingGateway
      container.resolve("IAiChatGateway"),
      container.resolve("IStorageGateway"),
      container.resolve("ISpeechToTextGateway"),
      config.summarization,
    ),
  "singleton");
  ```

### Step 7: Update Implementations

All three implementations now implement `IWhatsAppMessagingGateway` (which extends `IMessagingGateway`):

- `WhatsAppMessagingGateway` — rename `receiveMessage` → `receiveWhatsAppMessage`
- `TuiWhatsAppMessagingGateway` — same rename
- `TestWhatsAppMessagingGateway` — same rename

### Step 8: No Schema Changes

`chat.type` is VARCHAR — supports any provider value. No migrations needed.

## Message Flow (After Refactor)

### WhatsApp Flow
```
Route POST /api/v1/whatsapp/webhook
  → MessagingService.receiveWhatsAppMessage(rawBody, signature)
    → IWhatsAppMessagingGateway.validateSignature()
    → IWhatsAppMessagingGateway.receiveWhatsAppMessage(data) → DTO
    → MessagingService.listenToMessage(dto)
      → dedup, auth, chat lookup/create (sets chat.type from dto.chatType)
      → persist message
      → Mediator.send("RespondToMessage", { chat, message })
        → MessagingService.respondToMessage(chat, message)
          → getMessagingGatewayByChatType(chat.type) → IMessagingGateway
          → gateway.sendTextMessage() / gateway.sendInteractiveReplyButtonMessage()
```

### Future Web Chat Flow
```
Route POST /api/v1/web/message
  → MessagingService.receiveWebMessage(rawBody, ...)
    → IWebChatMessagingGateway.receiveWebMessage(data) → DTO
    → MessagingService.listenToMessage(dto)  ← same shared pipeline
```

## Risks / Flagged for Later

- **Auth confirmations** — `"SaveUserByGoogleCredential"` always sends via WhatsApp. Revisit when web auth exists.
- **MessageType.ButtonReply** has value `"interactive"` in DB — legacy WhatsApp jargon. No rename to avoid migration.
- **Chat type flipping** — `chat.type` changes if user switches providers. Revisit if concurrent multi-provider chats are needed.
- **Phone number on web** — Web chat must provide phone number somehow (auth, input, session). Implementation detail for later.
