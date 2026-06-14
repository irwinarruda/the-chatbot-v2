# Plan 006: Provider IDs for WhatsApp BSUID and Web Email

## Problem

The current project uses WhatsApp phone numbers as the main chat identifier.
That breaks with Meta's BSUID rollout because WhatsApp webhooks can contain a
business-scoped user ID while the phone number is empty or omitted.

The intended model is provider-based:

- `User` owns account aliases: optional `phoneNumber`, `email`, and `bsuid`.
- `Chat` owns provider connections: `whatsAppId` and `webId`.
- WhatsApp provider ID is stored in `chats.whatsapp_id`.
- Web provider ID is stored in `chats.web_id`.
- Existing phone numbers can temporarily live in `chats.whatsapp_id`.
- When a webhook contains both phone and BSUID, promote the existing
  `whatsapp_id` from phone number to BSUID.

This avoids a separate `fallbackPhoneNumber` in receive DTOs. During migration,
`whatsapp_id` can be either:

1. a legacy phone number, or
2. the new Meta BSUID.

The send gateway decides how to address WhatsApp based on the provider ID
shape: BSUID goes to `recipient.user_id`; phone number goes to `to`.

## Research Notes

The approach is compatible with the Meta change as long as we accept the
transition caveat below.

Relevant behavior from current BSUID docs:

- BSUID uniquely identifies a WhatsApp user for a business portfolio and can be
  used to message a user when the phone number is not known.
- BSUID is exposed in webhook/user fields such as `user_id` and appears
  alongside phone data when phone is available.
- Phone numbers may be empty or omitted when a user has adopted a username.
- Phone and BSUID can coexist for some period, especially for existing
  interactions and Contact Book/history cases.
- BSUID format includes a country-code prefix and a period, for example
  `US.13491208655302741918`.

References:

- Meta mirror: https://whatsapp-docs.kap.so/documentation/whatsapp/business-scoped-user-ids
- Microsoft summary of the Meta change: https://learn.microsoft.com/en-us/azure/communication-services/concepts/advanced-messaging/whatsapp/whatsapp-username-support-overview

Important caveat:

If a production chat only has the legacy phone number and the first future
webhook for that user is BSUID-only, there is no deterministic local mapping
from BSUID back to the old phone-number chat. The proposed runtime promotion
works when a webhook contains both values at least once:

```text
old chats.whatsapp_id = phone
incoming webhook = { user_id: BSUID, wa_id: phone }
runtime promotion = UPDATE whatsapp_id from phone to BSUID
future webhooks = { user_id: BSUID, wa_id missing }
lookup works by BSUID
```

That is acceptable for a small production user base if we expect active users to
produce at least one dual-ID webhook before phone disappears. For any user that
does not, we need manual repair or Contact Book mapping. Proactively requesting
contact info is intentionally out of scope for this migration.

## Target Identity Model

### User

`User` remains the authenticated user/account object.

```typescript
export class User {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  bsuid?: string;
  isInactive: boolean;
  createdAt: Date;
  updatedAt: Date;
  googleCredential?: Credential;
}
```

Business rules:

- `email` is the source of truth after Google login.
- `phoneNumber` remains an optional user alias for compatibility.
- `bsuid` is the user's current WhatsApp business-scoped user ID.
- A user can exist with Google email and BSUID before the phone number is known.
- Constructors and update methods should validate the phone only when a phone
  value is present.
- Do not add `normalizeBsuid()`. Store Meta's provider ID as received.
- Basic checks may reject empty values, but do not transform BSUID casing or
  structure.

### Chat

`Chat` stops storing `phoneNumber`.

```typescript
export class Chat {
  id: string;
  idUser?: string;
  whatsAppId?: string;
  webId?: string;
  type: ChatType;
  messages: Message[];
  summary?: string;
  summarizedUntilId?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;

  constructor() {
    this.id = uuidv4();
    this.idUser = undefined;
    this.whatsAppId = undefined;
    this.webId = undefined;
    this.type = ChatType.WhatsApp;
    this.messages = [];
    this.summary = undefined;
    this.summarizedUntilId = undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDeleted = false;
  }

  setProviderId(providerId: string, chatType: ChatType): void {
    if (!providerId) {
      throw new ValidationException("Provider ID is required");
    }
    if (chatType === ChatType.WhatsApp) {
      this.whatsAppId = providerId;
    } else if (chatType === ChatType.Web) {
      this.webId = providerId.toLowerCase();
    } else {
      throw new ValidationException("Unsupported chat type");
    }
    this.updatedAt = new Date();
  }

  getProviderId(): string | undefined {
    if (this.type === ChatType.WhatsApp) return this.whatsAppId;
    if (this.type === ChatType.Web) return this.webId;
    return undefined;
  }

  toJSON() {
    return {
      id: this.id,
      whatsAppId: this.whatsAppId,
      webId: this.webId,
      type: this.type.toLowerCase(),
      messages: this.messages.map((m) => m.toJSON()),
      summary: this.summary,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isDeleted: this.isDeleted,
    };
  }
}
```

Provider meaning:

| Chat type | Chat field | Provider ID |
|---|---|---|
| WhatsApp | `whatsAppId` | Initially phone for legacy rows; promoted to BSUID |
| Web | `webId` | Google email |

### Allowed ID

The existing table can remain `allowed_numbers`, but service code should treat
it as allowed provider IDs.

```typescript
export class AllowedId {
  id: string;
  whatsAppId?: string;
  createdAt: Date;

  constructor(whatsAppId: string) {
    this.id = uuidv4();
    this.createdAt = new Date();
    this.whatsAppId = whatsAppId.trim();
    if (!this.whatsAppId) {
      throw new ValidationException("Allowed WhatsApp ID is required");
    }
  }
}
```

During migration, `allowed_numbers.whatsapp_id` can contain either a legacy
phone number or a BSUID. This means `isAllowedId(id)` only needs one parameter.

## Database Migration

Create:

```bash
bun run migrate:create -- provider-chat-ids
```

All one-time data `UPDATE` statements must live in the migration file. Runtime
promotion from phone to BSUID still happens in `receiveWhatsAppMessage()` flow,
because the BSUID values do not exist until future webhooks arrive.

### Up Migration

```sql
ALTER TABLE users ADD COLUMN bsuid VARCHAR(255);
ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;

CREATE UNIQUE INDEX "UX_users_email_lower"
ON users (lower(email))
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX "UX_users_bsuid"
ON users (bsuid)
WHERE bsuid IS NOT NULL;

ALTER TABLE chats ADD COLUMN whatsapp_id VARCHAR(255);
ALTER TABLE chats ADD COLUMN web_id VARCHAR(255);

UPDATE chats
SET whatsapp_id = phone_number
WHERE type = 'WhatsApp'
AND whatsapp_id IS NULL
AND phone_number IS NOT NULL;

UPDATE chats
SET web_id = lower(u.email)
FROM users u
WHERE chats.id_user = u.id
AND chats.type = 'Web'
AND chats.web_id IS NULL
AND u.email IS NOT NULL;

CREATE INDEX "IX_chats_whatsapp_id_active"
ON chats (whatsapp_id, created_at DESC)
WHERE whatsapp_id IS NOT NULL AND is_deleted = false;

CREATE INDEX "IX_chats_web_id_active"
ON chats (web_id, created_at DESC)
WHERE web_id IS NOT NULL AND is_deleted = false;

CREATE INDEX "IX_chats_user_type_active"
ON chats (id_user, type, created_at DESC)
WHERE id_user IS NOT NULL AND is_deleted = false;

ALTER TABLE allowed_numbers ADD COLUMN whatsapp_id VARCHAR(255);

UPDATE allowed_numbers
SET whatsapp_id = phone_number
WHERE whatsapp_id IS NULL
AND phone_number IS NOT NULL;

CREATE UNIQUE INDEX "UX_allowed_numbers_whatsapp_id"
ON allowed_numbers (whatsapp_id)
WHERE whatsapp_id IS NOT NULL;
```

Do not drop `chats.phone_number` in this migration. It is no longer hydrated
into `Chat`, but keeping the column gives us a rollback/debug path and lets old
code/tests survive while wrappers are removed.

Preflight for email uniqueness:

```sql
SELECT lower(email), count(*)
FROM users
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1;
```

If rows are returned, resolve them manually before running the migration.

### Down Migration

```sql
DROP INDEX "UX_allowed_numbers_whatsapp_id";
ALTER TABLE allowed_numbers DROP COLUMN whatsapp_id;

DROP INDEX "IX_chats_user_type_active";
DROP INDEX "IX_chats_web_id_active";
DROP INDEX "IX_chats_whatsapp_id_active";
ALTER TABLE chats DROP COLUMN web_id;
ALTER TABLE chats DROP COLUMN whatsapp_id;

DROP INDEX "UX_users_bsuid";
DROP INDEX "UX_users_email_lower";
ALTER TABLE users DROP COLUMN bsuid;
ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;
```

The down migration should only set `users.phone_number NOT NULL` if no user has
a null phone number. If null rows exist, fail instead of inventing placeholder
phones.

Future cleanup migration, only after production rows are promoted:

```sql
ALTER TABLE chats DROP COLUMN phone_number;
ALTER TABLE allowed_numbers DROP COLUMN phone_number;
```

## DTO and Interface Changes

Replace `from` with `fromId`.

```typescript
export interface ReceiveMessageDTO {
  fromId: string;
  phoneNumber?: string;
  idProvider: string;
  chatType: ChatType;
}

export interface ReceiveTextMessageDTO extends ReceiveMessageDTO {
  text: string;
}

export interface ReceiveInteractiveButtonMessageDTO
  extends ReceiveMessageDTO {
  buttonReply: string;
}

export interface ReceiveAudioMessageDTO extends ReceiveMessageDTO {
  mediaId: string;
  mimeType: string;
}
```

`phoneNumber` is not a fallback identity. It is observed WhatsApp phone data
used to:

- update `User.phoneNumber`;
- create Google login URLs;
- promote legacy `whatsapp_id = phone` rows to `whatsapp_id = BSUID`.

Send DTOs use `toId`:

```typescript
export interface SendTextMessageDTO {
  toId: string;
  text: string;
}

export interface SendInteractiveButtonMessageDTO {
  toId: string;
  text: string;
  buttons: string[];
}
```

`toId` can be a phone number or a BSUID during migration.

## WhatsApp Gateway Changes

### Receiving Messages

Extract both provider ID and observed phone. Prefer BSUID.

```typescript
const contact = value?.contacts?.[0];
const message = messages[0];
const bsuid = message.from_user_id ?? contact?.user_id ?? undefined;
const phoneNumber = contact?.wa_id
  ? PhoneNumberUtils.addDigitNine(contact.wa_id)
  : undefined;
const fromId = bsuid ?? phoneNumber;

if (!fromId) return undefined;
```

Text example:

```typescript
if (message.text) {
  return {
    fromId,
    phoneNumber,
    idProvider: message.id,
    chatType: ChatType.WhatsApp,
    text: message.text.body,
  } as ReceiveTextMessageDTO;
}
```

Behavior:

- BSUID + phone: `fromId = bsuid`, `phoneNumber = phone`.
- BSUID only: `fromId = bsuid`, `phoneNumber = undefined`.
- Phone only: `fromId = phone`, `phoneNumber = phone`.
- No ID: return `undefined`.

### Sending Messages

The gateway only needs `toId` and currently sends it through WhatsApp's `to`
field.

```typescript
body: JSON.stringify({
  messaging_product: "whatsapp",
  to: dto.toId,
  type: "text",
  text: { body: chunk },
});
```

## Web Gateway Changes

Web provider ID is the Google email.

Controller:

```typescript
await messagingService.receiveWebMessage(
  context.webAuth.email,
  await request.json(),
);
```

Gateway:

```typescript
private createBaseReceiveMessage(webId: string): ReceiveMessageDTO {
  return {
    fromId: webId.toLowerCase(),
    chatType: ChatType.Web,
    idProvider: crypto.randomUUID(),
  };
}
```

Web stream methods should use `webId`:

```typescript
subscribe(webId: string, signal: AbortSignal)
enqueue(webId: string, event: WebChatEvent)
```

## MessagingService Changes

### WhatsApp Receive Flow

Keep WhatsApp ID promotion inside the WhatsApp-specific entrypoint. The generic
`listenToMessage()` method should not know about WhatsApp migration details.

```typescript
async receiveWhatsAppMessage(
  rawBody: string,
  signature?: string,
): Promise<void> {
  if (
    !signature ||
    !this.whatsAppMessagingGateway.validateSignature(signature, rawBody)
  ) {
    throw new UnauthorizedException(
      "Invalid Signature",
      "Please check your request signature.",
    );
  }
  const data = JSON.parse(rawBody);
  const receiveMessage =
    this.whatsAppMessagingGateway.receiveWhatsAppMessage(data);
  if (!receiveMessage) return;
  await this.promoteWhatsAppIdIfNeeded(receiveMessage);
  await this.listenToMessage(receiveMessage);
}
```

### Main Receive Flow

```typescript
async listenToMessage(receiveMessage: ReceiveMessageDTO): Promise<void> {
  if (await this.isMessageDuplicate(receiveMessage.idProvider)) return;
  if (receiveMessage.chatType === ChatType.WhatsApp) {
    if (!(await this.isAllowedId(receiveMessage.fromId))) return;
  }
  let chat = await this.getChatByProviderId(
    receiveMessage.chatType,
    receiveMessage.fromId,
  );
  if (!chat) {
    chat = new Chat();
    chat.type = receiveMessage.chatType;
    chat.setProviderId(receiveMessage.fromId, receiveMessage.chatType);
    await this.createChat(chat);
  }
  const message = this.addReceiveMessageToChat(chat, receiveMessage);
  if (!(await this.createMessage(message))) return;
  if (!(await this.ensureChatHasUser(chat, receiveMessage))) return;
  await this.mediator.send("RespondToMessage", {
    chat,
    message,
    chatType: receiveMessage.chatType,
  } as RespondToMessageEvent);
}
```

### Runtime WhatsApp ID Promotion

This is the only runtime `UPDATE` path in this migration. It cannot be a
one-time migration statement because the BSUID arrives later through webhooks.

```typescript
private async promoteWhatsAppIdIfNeeded(
  receiveMessage: ReceiveMessageDTO,
): Promise<void> {
  if (receiveMessage.chatType !== ChatType.WhatsApp) return;
  if (!receiveMessage.phoneNumber) return;
  if (receiveMessage.fromId === receiveMessage.phoneNumber) return;
  const now = new Date();
  await this.database.sql`
    UPDATE chats
    SET whatsapp_id = ${receiveMessage.fromId},
        updated_at = ${now}
    WHERE whatsapp_id = ${receiveMessage.phoneNumber}
    AND type = ${ChatType.WhatsApp}
  `;
  await this.database.sql`
    UPDATE allowed_numbers
    SET whatsapp_id = ${receiveMessage.fromId}
    WHERE whatsapp_id = ${receiveMessage.phoneNumber}
  `;
  await this.database.sql`
    UPDATE users
    SET bsuid = ${receiveMessage.fromId},
        updated_at = ${now}
    WHERE phone_number = ${receiveMessage.phoneNumber}
    AND bsuid IS NULL
  `;
}
```

`receiveWhatsAppMessage()` calls this method before delegating to
`listenToMessage()`, so a dual-ID webhook can immediately turn old phone-based
`whatsapp_id` rows into BSUID rows before lookup and allowlist checks run.

### Chat Lookup

Replace main message-flow usage of `getChatByPhoneNumber()` with
`getChatByProviderId()`.

```typescript
async getChatByProviderId(
  chatType: ChatType,
  providerId: string,
): Promise<Chat | undefined> {
  if (chatType === ChatType.WhatsApp) {
    return this.getWhatsAppChatById(providerId);
  }
  if (chatType === ChatType.Web) {
    return this.getWebChatById(providerId);
  }
  throw new ValidationException("Unsupported chat type");
}
```

WhatsApp:

```typescript
private async getWhatsAppChatById(
  whatsAppId: string,
): Promise<Chat | undefined> {
  const dbChats = await this.database.sql<DbChat[]>`
    SELECT * FROM chats
    WHERE whatsapp_id = ${whatsAppId}
    AND type = ${ChatType.WhatsApp}
    AND is_deleted = false
    ORDER BY created_at DESC
  `;
  const dbChat = dbChats[0];
  if (!dbChat) return undefined;
  return this.hydrateChat(dbChat);
}
```

Web:

```typescript
private async getWebChatById(webId: string): Promise<Chat | undefined> {
  const dbChats = await this.database.sql<DbChat[]>`
    SELECT * FROM chats
    WHERE web_id = ${webId.toLowerCase()}
    AND type = ${ChatType.Web}
    AND is_deleted = false
    ORDER BY created_at DESC
  `;
  const dbChat = dbChats[0];
  if (!dbChat) return undefined;
  return this.hydrateChat(dbChat);
}
```

Temporary wrapper:

```typescript
async getChatByPhoneNumber(phoneNumber: string): Promise<Chat | undefined> {
  return this.getChatByProviderId(
    ChatType.WhatsApp,
    PhoneNumberUtils.addDigitNine(phoneNumber),
  );
}
```

### Chat Hydration and Persistence

`DbChat` still includes `phone_number`, but `Chat` does not.

```typescript
interface DbChat {
  id: string;
  id_user: string | null;
  phone_number: string | null;
  whatsapp_id: string | null;
  web_id: string | null;
  type: string;
  summary: string | null;
  summarized_until_id: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}
```

Hydrate:

```typescript
const chat = new Chat();
chat.id = dbChat.id;
chat.idUser = dbChat.id_user ?? undefined;
chat.type = dbChat.type as ChatType;
chat.whatsAppId = dbChat.whatsapp_id ?? undefined;
chat.webId = dbChat.web_id ?? undefined;
```

Insert:

```typescript
const idUser = chat.idUser ?? null;
const whatsAppId = chat.whatsAppId ?? null;
const webId = chat.webId ?? null;
await this.database.sql`
  INSERT INTO chats (
    id,
    id_user,
    type,
    whatsapp_id,
    web_id,
    created_at,
    updated_at,
    is_deleted
  )
  VALUES (
    ${chat.id},
    ${idUser},
    ${chat.type},
    ${whatsAppId},
    ${webId},
    ${chat.createdAt},
    ${chat.updatedAt},
    ${chat.isDeleted}
  )
`;
```

Update:

```typescript
await this.database.sql`
  UPDATE chats SET
    id_user = ${idUser},
    type = ${chat.type},
    whatsapp_id = ${whatsAppId},
    web_id = ${webId},
    updated_at = ${chat.updatedAt},
    summary = ${summary},
    summarized_until_id = ${summarizedUntilId},
    is_deleted = ${chat.isDeleted}
  WHERE id = ${chat.id}
`;
```

### Allowlist

`isAllowedNumber()` becomes `isAllowedId()`.

```typescript
private async isAllowedId(whatsAppId: string): Promise<boolean> {
  const result = await this.database.sql<{ exists: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM allowed_numbers
      WHERE whatsapp_id = ${whatsAppId}
    )
  `;
  return result[0]?.exists ?? false;
}
```

Compatibility:

```typescript
async addAllowedNumber(phoneNumber: string): Promise<void> {
  await this.addAllowedId(PhoneNumberUtils.addDigitNine(phoneNumber));
}

async addAllowedId(whatsAppId: string): Promise<void> {
  const allowed = new AllowedId(whatsAppId);
  await this.database.sql`
    INSERT INTO allowed_numbers (id, whatsapp_id, created_at)
    VALUES (${allowed.id}, ${allowed.whatsAppId}, ${allowed.createdAt})
    ON CONFLICT DO NOTHING
  `;
}
```

Because migration copies `phone_number` into `whatsapp_id`, old phone allowlist
rows still work.

### User Attachment

```typescript
private async ensureChatHasUser(
  chat: Chat,
  receiveMessage: ReceiveMessageDTO,
): Promise<boolean> {
  if (chat.idUser) return true;
  const user =
    chat.type === ChatType.Web
      ? await this.authService.getUserByEmail(receiveMessage.fromId)
      : await this.authService.getUserByProviderId(
          receiveMessage.fromId,
          receiveMessage.phoneNumber,
        );
  if (user) {
    chat.addUser(user.id);
    await this.saveChat(chat);
    return true;
  }
  if (chat.type === ChatType.Web) return false;
  await this.sendLoginMessage(chat, receiveMessage);
  return false;
}
```

Auth lookup:

```typescript
async getUserByProviderId(
  providerId: string,
  phoneNumber?: string,
): Promise<User | undefined> {
  const byBsuid = await this.getUserByBsuid(providerId);
  if (byBsuid) return byBsuid;
  if (!phoneNumber) return undefined;
  return this.getUserByPhoneNumber(phoneNumber);
}
```

### Login Message

Chat no longer has phone, so use observed message phone data only when it
exists. A BSUID-only user can still receive a Google login URL because
`whatsAppId` is enough to bind the OAuth callback to the WhatsApp provider ID.

```typescript
private async sendLoginMessage(
  chat: Chat,
  receiveMessage: ReceiveMessageDTO,
): Promise<void> {
  await this.sendTextMessage(
    {
      chatType: ChatType.WhatsApp,
      toId: receiveMessage.fromId,
    },
    MessageLoader.getMessage(MessageTemplate.ThankYou, {
      loginUrl: this.authService.getAppLoginUrl({
        phoneNumber: receiveMessage.phoneNumber,
        whatsAppId: receiveMessage.fromId,
      }),
    }),
    chat,
  );
}
```

### Send Methods

```typescript
export interface SendMessageRecipient {
  chatType: ChatType;
  toId: string;
}

async sendTextMessage(
  recipient: string | SendMessageRecipient,
  text: string,
  chat?: Chat,
): Promise<void> {
  const dto =
    typeof recipient === "string"
      ? { chatType: ChatType.WhatsApp, toId: recipient }
      : recipient;
  chat ??= await this.getChatByProviderId(dto.chatType, dto.toId);
  if (!chat) {
    throw new ValidationException(
      "The user does not have an open chat",
      "Please create a chat first before continuing",
    );
  }
  const gateway = this.getMessagingGatewayByChatType(dto.chatType);
  const message = chat.addBotTextMessage(text);
  await this.createMessage(message);
  await gateway.sendTextMessage({ toId: dto.toId, text });
}
```

`sendButtonReplyMessage()` follows the same recipient shape.

### AI Response Context

```typescript
const providerId = chat.getProviderId() ?? chat.id;
const response = await this.aiChatGateway.getResponse(
  providerId,
  aiMessages,
  true,
  {
    idSourceMessage: message.id,
    idUser: chat.idUser,
    providerId,
    chatType: chat.type,
  },
);
```

## AuthService Changes

### User Persistence

Add `bsuid` everywhere `User` is hydrated or persisted.

```typescript
async getUserByBsuid(bsuid: string): Promise<User | undefined> {
  const dbUsers = await this.database.sql<DbUser[]>`
    SELECT * FROM users
    WHERE bsuid = ${bsuid}
  `;
  const dbUser = dbUsers[0];
  if (!dbUser) return undefined;
  return this.hydrateUser(dbUser);
}
```

Hydrate:

```typescript
user.bsuid = dbUser.bsuid ?? undefined;
```

Create/update:

```typescript
const phoneNumber = user.phoneNumber ?? null;
const bsuid = user.bsuid ?? null;
```

```sql
INSERT INTO users (id, name, phone_number, email, bsuid, created_at, updated_at)
VALUES (..., ${phoneNumber}, ...);
```

```sql
UPDATE users SET
  name = ...,
  email = ...,
  phone_number = ${phoneNumber},
  bsuid = ...,
  is_inactive = ...,
  updated_at = ...
WHERE id = ...
```

### Email-First Google Login

App login state:

```typescript
interface AppGoogleLoginState {
  phoneNumber?: string;
  whatsAppId?: string;
}
```

Support legacy phone-only encrypted state:

```typescript
private decryptAppState(state: string): AppGoogleLoginState {
  const encryption = new Encryption(this.encryptionConfig);
  const decrypted = encryption.decrypt(state);
  try {
    const parsed = JSON.parse(decrypted) as AppGoogleLoginState;
    return {
      phoneNumber: parsed.phoneNumber
        ? PhoneNumberUtils.addDigitNine(parsed.phoneNumber)
        : undefined,
      whatsAppId: parsed.whatsAppId,
    };
  } catch {
    return { phoneNumber: PhoneNumberUtils.addDigitNine(decrypted) };
  }
}
```

Resolve after Google userinfo:

```typescript
const email = userinfo.email.toLowerCase();
const userByEmail = await this.getUserByEmail(email);
const userByPhone = state.phoneNumber
  ? await this.getUserByPhoneNumber(state.phoneNumber)
  : undefined;
const userByBsuid = state.whatsAppId
  ? await this.getUserByBsuid(state.whatsAppId)
  : undefined;
const aliasUser = userByPhone ?? userByBsuid;

if (userByEmail && aliasUser && userByEmail.id !== aliasUser.id) {
  throw new UnauthorizedException(
    "The logged in Google account does not match this WhatsApp identity.",
    "Log in with the correct Google account and try again.",
  );
}

const user = userByEmail ?? aliasUser ?? new User(
  userinfo.name,
  state.phoneNumber,
  email,
);
user.email ??= email;
user.phoneNumber = state.phoneNumber ?? user.phoneNumber;
user.bsuid = state.whatsAppId ?? user.bsuid;
```

Rules:

- Email wins once known.
- Phone or BSUID can upgrade a legacy user before email exists.
- Email plus different alias user is a conflict.
- New users are created with email and whichever aliases are available.
- App OAuth state is valid when it contains at least one provider alias:
  `phoneNumber` or `whatsAppId`.

### App Login URL

```typescript
getAppLoginUrl(dto: {
  phoneNumber?: string;
  whatsAppId?: string;
}): string {
  if (!dto.phoneNumber && !dto.whatsAppId) {
    throw new ValidationException("Login provider ID is required");
  }
  const url = new URL(this.config.loginUri);
  if (dto.phoneNumber) url.searchParams.set("phone_number", dto.phoneNumber);
  if (dto.whatsAppId) url.searchParams.set("whatsapp_id", dto.whatsAppId);
  return url.toString();
}
```

Google login controller:

```typescript
const phoneNumber = url.searchParams.get("phone_number") ?? undefined;
const whatsAppId = url.searchParams.get("whatsapp_id") ?? undefined;
const result = await authService.handleGoogleLogin({
  phoneNumber,
  whatsAppId,
});
```

## Web Auth Changes

JWT payload:

```typescript
export interface WebAuthTokenPayload {
  userId: string;
  email: string;
  phoneNumber?: string;
}
```

Validation:

```typescript
if (!payload.userId || !payload.email) {
  throw new UnauthorizedException(
    "Invalid authentication token",
    "Please log in again.",
  );
}
```

`WebAuth.requireAuth()` returns email and optional phone:

```typescript
return {
  userId: user.id,
  email: user.email ?? "",
  phoneNumber: user.phoneNumber,
};
```

Web chat controllers use `context.webAuth.email` as provider ID.

## AI Tool Changes

Tool execution should resolve the user from server context first.

```typescript
async function resolveToolUser(
  args: Record<string, unknown>,
  authService: AuthService,
  context?: AiChatContext,
): Promise<User> {
  if (typeof context?.idUser === "string") {
    const user = await authService.getUserById(context.idUser);
    if (!user) throw new ValidationException("User not found");
    return user;
  }
  const phoneNumber = args.phone_number as string;
  const user = await authService.getUserByPhoneNumber(phoneNumber);
  if (!user) throw new ValidationException("User not found");
  return user;
}
```

Todo tools use `user.id`. Cash-flow tools can keep passing
`user.phoneNumber` into existing `CashFlowService` methods to avoid a larger
cash-flow rewrite, but they must fail with a clear validation error when the
authenticated user has no phone alias yet.

```typescript
if (!user.phoneNumber) {
  throw new ValidationException(
    "User phone number is required for cash-flow tools",
    "Share your phone number before using spreadsheet-backed financial tools.",
  );
}
```

## Compatibility Strategy

1. Migration copies existing `chats.phone_number` into `chats.whatsapp_id`.
2. Migration copies existing `allowed_numbers.phone_number` into
   `allowed_numbers.whatsapp_id`.
3. New `Chat` entity has no `phoneNumber`.
4. `receiveWhatsAppMessage()` emits `fromId` and optional observed
   `phoneNumber`.
5. On dual-ID webhooks, `receiveWhatsAppMessage()` calls
   `promoteWhatsAppIdIfNeeded()` to update phone-valued `whatsapp_id` rows to
   BSUID-valued rows before generic message handling.
6. `getChatByProviderId(ChatType.WhatsApp, id)` only queries `whatsapp_id`.
7. `getChatByPhoneNumber()` remains as a wrapper for old callers/tests.
8. Once production has no phone-valued `whatsapp_id` rows, remove the wrappers
   and drop legacy phone columns.

Check production progress:

```sql
SELECT count(*)
FROM chats
WHERE type = 'WhatsApp'
AND whatsapp_id IS NOT NULL
AND whatsapp_id !~ '^[A-Z]{2}\.';
```

## Implementation Order

1. Add migration with `users.bsuid`, `chats.whatsapp_id`, `chats.web_id`, and
   `allowed_numbers.whatsapp_id`.
2. Put all one-time backfill `UPDATE` SQL in that migration.
3. Update `User` with optional `phoneNumber` and `bsuid`.
4. Replace `Chat.phoneNumber` with `whatsAppId` and `webId`.
5. Update allowed ID model/service language.
6. Change receive DTOs from `from` to `fromId` and sends from `to` to `toId`.
7. Update WhatsApp gateway to emit `fromId` and observed `phoneNumber`.
8. Update Web gateway/controllers to use email as `fromId` / `webId`.
9. Add runtime WhatsApp ID promotion in `receiveWhatsAppMessage()`, before it
   calls `listenToMessage()`.
10. Replace `isAllowedNumber()` with `isAllowedId()`.
11. Replace message-flow lookup with `getChatByProviderId()`.
12. Update send flows to use provider recipients.
13. Update AuthService for `User.bsuid` and email-first login.
14. Update AI tool execution to resolve user from context first.
15. Update tests.

## Test Plan

### Entity Tests

- `User` stores and serializes `bsuid`.
- `Chat` has no `phoneNumber`.
- `Chat.setProviderId(id, ChatType.WhatsApp)` sets `whatsAppId`.
- `Chat.setProviderId(email, ChatType.Web)` sets lowercased `webId`.
- Allowed ID model accepts a phone-valued or BSUID-valued WhatsApp ID.

### Migration Tests/Checks

- Existing users allow `phone_number = NULL` after migration.
- Existing WhatsApp chats get `whatsapp_id = phone_number`.
- Existing Web chats with users get `web_id = lower(users.email)`.
- Existing allowed numbers get `whatsapp_id = phone_number`.
- Email duplicate preflight is documented and run before production migration.

### WhatsApp Tests

- Webhook with `from_user_id` and `wa_id` returns `fromId = BSUID` and
  `phoneNumber = phone`.
- Webhook with only `wa_id` returns `fromId = phone`.
- Webhook with only `from_user_id` returns `fromId = BSUID`.
- WhatsApp send with BSUID uses `recipient.user_id`.
- WhatsApp send with phone-valued `toId` uses `to`.
- Contact-info response updates user phone but does not write phone into Chat.

### MessagingService Tests

- `promoteWhatsAppIdIfNeeded()` updates chat, allowed ID, and user BSUID from a
  dual-ID webhook.
- `isAllowedId()` passes for phone-valued migrated rows.
- `isAllowedId()` passes for BSUID-valued promoted rows.
- `getChatByProviderId(WhatsApp, id)` finds by `whatsapp_id`.
- New WhatsApp chat stores `whatsAppId`, not `phoneNumber`.
- Web chat stores `webId` as email.
- `getChatByPhoneNumber()` wrapper still works during migration.
- `listenToMessage()` never creates a chat with empty provider ID.

### AuthService Tests

- Google redirect creates `User` with email and BSUID even when phone is absent.
- Google redirect stores phone when phone is present.
- Google redirect finds existing user by email first.
- Google redirect uses phone/BSUID to upgrade a legacy user without email.
- Conflicting email user and phone/BSUID user throws `UnauthorizedException`.
- Web JWT validates `userId + email` and does not require phone.

### AI Tool Tests

- Tool execution uses `context.idUser` before `args.phone_number`.
- Legacy tool execution without context still uses `phone_number`.
- Cash-flow tools still call existing service methods with `user.phoneNumber`
  when a phone alias exists.
- Cash-flow tools fail clearly when the resolved user has no phone alias.

### Regression Commands

```bash
bun run typecheck
bun run check
bun run test
```

## Acceptance Criteria

1. `Chat` no longer has a `phoneNumber` property.
2. WhatsApp chat identity is stored in `Chat.whatsAppId`.
3. Web chat identity is stored in `Chat.webId`.
4. Existing phone chats are migrated to `chats.whatsapp_id = phone_number`.
5. Dual-ID webhooks promote `whatsapp_id` from phone to BSUID.
6. Receive DTOs use `fromId`, not `from`.
7. Send DTOs use `toId`, not `to`.
8. There is no `fallbackPhoneNumber` field.
9. `isAllowedId()` replaces message-flow `isAllowedNumber()`.
10. `getChatByProviderId()` replaces message-flow `getChatByPhoneNumber()`.
11. `User` still has optional `phoneNumber`, plus `email` and `bsuid`.
12. Google email remains the authenticated user source of truth.

## Non-Goals

- Do not drop `chats.phone_number` in the first migration.
- Do not remove `User.phoneNumber`; make it optional.
- Do not redesign cash-flow service APIs in this migration.
- Do not add a proactive `REQUEST_CONTACT_INFO` template flow or new WhatsApp
  config for it.
- Do not implement WhatsApp username or `parent_bsuid`.
- Do not add a BSUID normalizer. Store Meta provider IDs as received.
