# Spec 001: WhatsApp BSUID & Username Migration

## References

- [Meta Developer Docs — Business-Scoped User IDs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/)
- [Meta Developer Docs — Usernames](https://developers.facebook.com/documentation/business-messaging/whatsapp/usernames)
- [Meta Developer Docs — Contact Book](https://developers.facebook.com/documentation/business-messaging/whatsapp/contact-book)
- [Digisac Blog — WhatsApp Username & BSUID (Portuguese)](https://digisac.com.br/blog/whatsapp-username-bsuid)

## Background

Meta is changing how WhatsApp user identity is surfaced in the Cloud API. Historically, every webhook payload included the user's phone number (`wa_id`). This phone number is the primary identifier used throughout this project — for user lookup, chat creation, access control, and message routing.

With the new changes, users can set a **username** and Meta introduces **BSUIDs** (Business-Scoped User IDs) as the new primary identifier. When a user enables a username, the `wa_id` field can be **omitted entirely** from webhook payloads. This means the phone number — the single identifier this codebase relies on — may no longer be available.

---

## The Change — In Detail

### BSUID (Business-Scoped User ID)

A permanent, unique identifier for each WhatsApp user, scoped to a specific business portfolio.

- **Format**: `CC.XXXXXXXXXX` — ISO 3166-1 alpha-2 country code, a period, then up to 128 alphanumeric characters. Example: `BR.13491208655302741918`.
- **Uniqueness**: Each BSUID is unique within a business portfolio. A user who interacts with multiple businesses gets a different BSUID for each.
- **Stability**: The BSUID is stable for the lifetime of the user-portfolio relationship. It only changes when the user changes their phone number (a `user_changed_user_id` system webhook fires in that case).
- **Parent BSUID**: For managed businesses with multiple portfolios under one umbrella, a `parent_bsuid` field may appear. This is the same BSUID across all child portfolios, enabling cross-portfolio identity matching. This is optional and only relevant for multi-portfolio setups.

### WhatsApp Usernames

Users can optionally set a public username. When enabled:

- The user's profile shows the username instead of their phone number.
- Webhook payloads may omit `wa_id` (the phone number).
- The username is displayed in the `contacts` object alongside the BSUID.

### Phone Number Visibility Rules

The phone number (`wa_id`) is still included in webhook payloads when **any** of these conditions are true:

1. The business has messaged or called the user within the last 30 days.
2. The user's phone number is in the business's uploaded contacts.
3. The user's phone number is in the business's **Contact Book** (a new Meta feature, April 2026, that auto-maintains phone-to-BSUID mappings based on interaction history).

When none of these conditions apply, `wa_id` is **omitted** from the payload.

### New Template Button: `REQUEST_CONTACT_INFO`

A new interactive button type (`URL` button with `request_contact_info` subtype) that businesses can send in templates. When tapped, the user's phone number is shared with the business. This is the proactive way to obtain a phone number when `wa_id` is missing.

### System Webhooks

A new system event type `user_changed_user_id` fires when a user changes their phone number. The payload includes both the old and new BSUIDs. The business must update its records to map to the new BSUID.

---

## Webhook Payload Changes

### Contact Object (status and message webhooks)

```jsonc
// BEFORE — current format
{
  "contacts": [{
    "wa_id": "5511999999999",
    "profile": { "name": "John" }
  }]
}

// AFTER — new format
{
  "contacts": [{
    "wa_id": "5511999999999",                // CAN BE OMITTED
    "user_id": "BR.13491208655302741918",    // NEW — BSUID
    "profile": { "name": "John" }
  }]
}
```

### Message Object (incoming messages)

```jsonc
// BEFORE — current format
{
  "messages": [{
    "from": "5511999999999",
    "id": "wamid.xxx",
    "type": "text",
    "text": { "body": "Hello" }
  }]
}

// AFTER — new format
{
  "messages": [{
    "from": "5511999999999",                  // CAN BE OMITTED
    "from_user_id": "BR.13491208655302741918", // NEW — BSUID
    "id": "wamid.xxx",
    "type": "text",
    "text": { "body": "Hello" }
  }]
}
```

### System Event: User Changed Phone Number

```jsonc
{
  "entry": [{
    "changes": [{
      "value": {
        "event": "user_changed_user_id",
        "user_id_event": {
          "old_user_id": "BR.13491208655302741918",
          "new_user_id": "BR.98765432109876543210",
          "phone_number": "5511988887777"
        }
      }
    }]
  }]
}
```

## Send Message API Changes

### Sending to a Phone Number (current, still supported)

```jsonc
POST /v22.0/{phone_number_id}/messages
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": { "body": "Hello" }
}
```

### Sending to a BSUID (new, available May/June 2026)

```jsonc
POST /v22.0/{phone_number_id}/messages
{
  "messaging_product": "whatsapp",
  "recipient": { "user_id": "BR.13491208655302741918" },
  "type": "text",
  "text": { "body": "Hello" }
}
```

The `to` field (phone number) and the `recipient` field (BSUID) are mutually exclusive. When both are present, the API returns an error.

---

## Timeline

| Date | Event |
|------|-------|
| March 31, 2026 | BSUIDs started appearing in webhook payloads (`user_id`, `from_user_id` fields added). Phone numbers still included for all existing users. |
| April 2026 | Business Contact Book launches — Meta auto-maintains phone-to-BSUID mappings based on interaction history. |
| May–June 2026 | Send messages using `recipient` field (BSUID) becomes available. Users who enable usernames may start omitting `wa_id`. |
| Ongoing | As more users adopt usernames, the number of webhook payloads without `wa_id` will increase. |

---

## Impact on This Project

### Current Architecture — Phone Number as Primary Identifier

The phone number is the single thread connecting the entire application. Every entity, every lookup, and every message flow depends on it:

```
Webhook → extract wa_id → normalize phone → check allowed_numbers → find/create chat → find/create user → reply to phone
```

When `wa_id` is omitted, this chain breaks at the very first step.

### Critical Impact Points

#### 1. Webhook Ingestion — `WhatsAppMessagingGateway.ts`

**File**: `src/server/resources/WhatsAppMessagingGateway.ts`

Lines 113–157 — `receiveWhatsAppMessage()`:

```ts
const contact = value?.contacts?.[0];
const from = PhoneNumberUtils.addDigitNine(contact?.wa_id ?? "");
```

When `wa_id` is `undefined`, `from` becomes `PhoneNumberUtils.addDigitNine("")` which returns `""`. This empty string is then passed as the `from` field in every `ReceiveMessageDTO`.

Lines 21–50 and 52–89 — `sendTextMessage()` and `sendInteractiveReplyButtonMessage()`:

```ts
body: JSON.stringify({
  messaging_product: "whatsapp",
  to: dto.to,
  // ...
})
```

Both send methods use the `to` field (phone number). They do not support the new `recipient` field format for BSUIDs.

#### 2. Phone Number Utility — `PhoneNumberUtils.ts`

**File**: `src/shared/entities/PhoneNumberUtils.ts`

```ts
static sanitize(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, "");  // Strips all non-digits
}

static isValid(phoneNumber: string): boolean {
  return phoneNumber.length >= 8 && phoneNumber.length <= 15;
}
```

If a BSUID like `BR.13491208655302741918` were passed through `sanitize()`, it would become `"13491208655302741918"` (19 digits). Then `isValid()` would return `false` (exceeds 15-character max). This utility assumes it always receives a phone number — it has no concept of BSUIDs.

#### 3. Gateway DTOs — `IMessagingGateway.ts`

**File**: `src/server/resources/IMessagingGateway.ts`

```ts
export interface SendTextMessageDTO {
  to: string;   // Phone number only — no BSUID support
  text: string;
}

export interface ReceiveMessageDTO {
  from: string; // Phone number only — no BSUID support
  idProvider: string;
  chatType: ChatType;
}
```

These interfaces have no field for BSUID, no way to indicate whether `from`/`to` is a phone number or a BSUID, and no optional phone number field for cases where `wa_id` is missing.

#### 4. Message Pipeline — `MessagingService.ts`

**File**: `src/server/services/MessagingService.ts`

Line 128 — Access control check:
```ts
if (!(await this.isAllowedNumber(receiveMessage.from))) return;
```
`isAllowedNumber("")` queries `allowed_numbers WHERE phone_number = ''` — no match, message silently dropped.

Line 129 — Chat lookup:
```ts
let chat = await this.getChatByPhoneNumber(receiveMessage.from);
```
`getChatByPhoneNumber("")` queries `chats WHERE phone_number = ''` — no chat found.

Line 132 — Chat creation:
```ts
chat.phoneNumber = receiveMessage.from;
```
Creates a chat with `phoneNumber = ""` — corrupts data.

Lines 158–163 — User lookup and login flow:
```ts
const user = await this.authService.getUserByPhoneNumber(chat.phoneNumber);
if (!user) {
  await this.sendTextMessage(
    chat.phoneNumber,  // empty string
    MessageLoader.getMessage(MessageTemplate.ThankYou, {
      loginUrl: this.authService.getAppLoginUrl(chat.phoneNumber),  // empty string
    }),
  );
  return;
}
```
Looks up user by empty phone, sends login URL with empty phone in the OAuth state.

Lines 268–270 — Text message reply:
```ts
await gateway.sendTextMessage({
  to: phoneNumber,  // uses phone number for `to`
  text,
});
```

Lines 291–293 — Button message reply:
```ts
await gateway.sendInteractiveReplyButtonMessage({
  to: chat.phoneNumber,  // uses phone number for `to`
  text,
  buttons: options,
});
```

Line 379 — Chat lookup query:
```ts
SELECT * FROM chats WHERE phone_number = ${phoneNumber} AND is_deleted = false
```

Line 511 — Allowed number check query:
```ts
SELECT EXISTS(SELECT 1 FROM allowed_numbers WHERE phone_number = ${phoneNumber})
```

#### 5. Auth Service — `AuthService.ts`

**File**: `src/server/services/AuthService.ts`

Lines 60–61 — Login URL generation:
```ts
getAppLoginUrl(phoneNumber: string): string {
  return this.googleAuthGateway.getAppLoginUrl(phoneNumber);
}
```
Embeds the phone number in the Google OAuth redirect URL as encrypted state. With an empty phone number, the OAuth flow breaks.

Lines 182–188 — JWT payload:
```ts
return jwt.sign({
  userId: user.id,
  email: user.email,
  phoneNumber: user.phoneNumber,
});
```
The JWT includes `phoneNumber`. If the user was created with an empty/invalid phone, the JWT carries bad data.

Lines 282–290 — User lookup:
```ts
async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
  const dbUsers = await this.database.sql<DbUser[]>`
    SELECT * FROM users WHERE phone_number = ${phoneNumber}
  `;
  // ...
}
```
Queries users table by phone number only — no BSUID lookup path exists.

#### 6. Entity Layer

**`src/shared/entities/User.ts`** (line 10):
```ts
phoneNumber: string;  // Required, validated via PhoneNumberUtils on construction
```
No BSUID field exists. The constructor (lines 27–43) validates phone format and rejects non-phone values.

**`src/shared/entities/Chat.ts`** (line 11):
```ts
phoneNumber: string;  // Required, used as the primary lookup key
```
No BSUID field. The `phoneNumber` is used as the unique identifier for chat lookups and message routing.

**`src/shared/entities/AllowedNumber.ts`** (line 6):
```ts
phoneNumber: string;  // The access control table is keyed entirely by phone number
```
The constructor (lines 9–12) normalizes the phone number via `PhoneNumberUtils.addDigitNine()`. No BSUID concept.

#### 7. Database Schema

**`users` table** (migration `1751331728000`):
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  CONSTRAINT uc_users_phone_number UNIQUE (phone_number)
)
```
`phone_number` is `NOT NULL` with a `UNIQUE` constraint. No column for BSUID.

**`chats` table** (migration `1753473690000`):
```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user UUID REFERENCES users(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
)
```
`phone_number` is `NOT NULL`. Chat lookups are done exclusively by `WHERE phone_number = $1`. No column for BSUID.

**`allowed_numbers` table** (migration `1757205755000`):
```sql
CREATE TABLE allowed_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  CONSTRAINT uc_allowed_numbers_phone_number UNIQUE (phone_number)
)
```
Access control is keyed entirely by phone number. No column for BSUID.

### Failure Scenario

When a user with an enabled username sends a message and `wa_id` is omitted:

1. **Webhook handler** — `from` is set to `""` (empty string)
2. **Access check** — `isAllowedNumber("")` queries `allowed_numbers` for `phone_number = ''`, finds no match, returns `false` — the message is silently dropped
3. If the access check were bypassed, **chat lookup** — `getChatByPhoneNumber("")` queries `chats` for `phone_number = ''`, finds no match
4. **Chat creation** — a new chat is created with `phoneNumber = ""`, polluting the database
5. **User lookup** — `getUserByPhoneNumber("")` queries `users` for `phone_number = ''`, finds no match
6. **Login URL** — `getAppLoginUrl("")` encrypts an empty string into the OAuth state — the redirect URL is broken
7. **Reply** — if a reply were attempted, it would send to an empty/invalid `to` address

**Result: users with usernames enabled who are not in the business contact book are completely unable to interact with the chatbot.**

---

## Required Changes

### 1. Database Migrations

Add a `bsuid` column to the three tables that currently use `phone_number` as the primary identifier.

**`users` table**:
- Add `bsuid VARCHAR(131)` column (2 char country code + period + up to 128 chars)
- Add `UNIQUE` constraint on `bsuid`
- `bsuid` should be nullable initially (existing users won't have one until they interact again)
- Keep `phone_number` — it is still used for Google OAuth login and will still appear for many users

**`chats` table**:
- Add `bsuid VARCHAR(131)` column
- Add index on `bsuid` for fast lookups
- `bsuid` should be nullable (existing chats have no BSUID)
- Chat lookup logic needs a new query path: first try `WHERE bsuid = $1`, fall back to `WHERE phone_number = $1`

**`allowed_numbers` table**:
- Add `bsuid VARCHAR(131)` column
- Add `UNIQUE` constraint on `bsuid`
- `bsuid` should be nullable (existing entries have no BSUID)
- Access check needs a new path: first try `WHERE bsuid = $1`, fall back to `WHERE phone_number = $1`

### 2. Entity Layer

**`User.ts`**:
- Add `bsuid?: string` field
- Do not validate BSUID through `PhoneNumberUtils` — it has a different format
- Update `toJSON()` to include `bsuid`

**`Chat.ts`**:
- Add `bsuid?: string` field
- Update `toJSON()` to include `bsuid`

**`AllowedNumber.ts`**:
- Add `bsuid?: string` field
- Update `toJSON()` to include `bsuid`

**`PhoneNumberUtils.ts`**:
- Add a `isBsuid(value: string): boolean` static method that checks for the `CC.XXXX` pattern (regex: `/^[A-Z]{2}\./`)
- Keep existing phone number methods unchanged — they still apply when a phone number is available

### 3. Gateway DTOs — `IMessagingGateway.ts`

**`ReceiveMessageDTO`**:
```ts
export interface ReceiveMessageDTO {
  from: string;        // Phone number (may be empty string if wa_id is omitted)
  bsuid?: string;      // NEW — BSUID from from_user_id / user_id
  idProvider: string;
  chatType: ChatType;
}
```

**`SendTextMessageDTO`** and **`SendInteractiveButtonMessageDTO`**:
```ts
export interface SendTextMessageDTO {
  to: string;          // Phone number (used when available)
  bsuid?: string;      // NEW — BSUID (used when phone number is unavailable)
  text: string;
}
```

The gateway should prefer `bsuid` (using the `recipient` field in the API) when present, and fall back to `to` (phone number) otherwise.

### 4. WhatsApp Gateway — `WhatsAppMessagingGateway.ts`

**`receiveWhatsAppMessage()`** — extract BSUID from the new webhook fields:
```ts
const contact = value?.contacts?.[0];
const message = messages[0];
const from = PhoneNumberUtils.addDigitNine(contact?.wa_id ?? "");
const bsuid = message.from_user_id ?? contact?.user_id ?? undefined;
// Return both in the DTO
```

**`sendTextMessage()` and `sendInteractiveReplyButtonMessage()`** — support the `recipient` field:
```ts
// Determine the recipient format
const recipientBody = dto.bsuid
  ? { recipient: { user_id: dto.bsuid } }
  : { to: dto.to };

body: JSON.stringify({
  messaging_product: "whatsapp",
  ...recipientBody,
  type: "text",
  text: { body: chunk },
})
```

**New handler** — `receiveWhatsAppSystemEvent()` to process `user_changed_user_id` events and update stored BSUID mappings.

### 5. Messaging Service — `MessagingService.ts`

This is the largest area of change. The core `listenToMessage()` flow needs to support BSUID-first, phone-number-fallback lookups.

**`listenToMessage()`**:
- Use `receiveMessage.bsuid` as the primary identifier when available
- New method `isAllowedIdentifier(bsuid?, phoneNumber?)` — checks `allowed_numbers` by BSUID first, then by phone
- New method `getChatByIdentifier(bsuid?, phoneNumber?)` — looks up chat by BSUID first, then by phone
- When creating a new chat, store both `bsuid` and `phoneNumber` (whichever is available)

**`sendTextMessage()` and `sendButtonReplyMessage()`**:
- Pass both `to` (phone number) and `bsuid` to the gateway DTO
- The gateway handles the API format (which field to use in the HTTP body)

**`getChatByPhoneNumber()`**:
- Add a companion `getChatByBsuid(bsuid: string)` method
- Create a unified `getChatByIdentifier(bsuid?: string, phoneNumber?: string)` that tries BSUID first, then phone

### 6. Auth Service — `AuthService.ts`

**`getUserByPhoneNumber()`**:
- Add companion `getUserByBsuid(bsuid: string)` method
- Create a unified lookup that tries BSUID first, then phone

**`getAppLoginUrl()`**:
- When `phoneNumber` is empty but `bsuid` is available, the OAuth login URL cannot be generated (Google OAuth requires a phone number). In this case, the bot should send a `REQUEST_CONTACT_INFO` button template to ask the user for their phone number before proceeding with login.

**JWT payload**:
- Consider including `bsuid` in the JWT payload for future-proofing

### 7. System Webhook Handler

A new handler for `user_changed_user_id` system events:

- Listen for system events in the webhook route (currently only message webhooks are processed)
- When received, find all entities (users, chats) with the old BSUID and update them to the new BSUID
- The event payload includes the new phone number — update that as well if the user exists

### 8. REQUEST_CONTACT_INFO Button Support

When a message arrives with only a BSUID (no phone number) and the user is not recognized:

- Instead of sending the login URL immediately, send a template message with a `REQUEST_CONTACT_INFO` button
- When the user taps the button, their phone number is shared via a new webhook event
- Use the returned phone number to proceed with the normal login flow

---

## Migration Strategy

### Phase 1 — Read-Only BSUID Support (do first)

1. Add `bsuid` columns to all three tables (nullable, no data loss)
2. Update entity classes with optional `bsuid` fields
3. Update `receiveWhatsAppMessage()` to extract and store BSUID from webhook payloads
4. Update `listenToMessage()` to store BSUID on new chats/users when available
5. No behavioral change — phone numbers still flow as before, but BSUIDs are being captured

This phase is safe because BSUIDs are already appearing in webhooks (since March 31, 2026). Capturing them now builds the mapping table before phone numbers start disappearing.

### Phase 2 — BSUID-First Lookups

1. Add BSUID-based lookup methods alongside existing phone-based ones
2. Modify `isAllowedNumber()`, `getChatByPhoneNumber()`, `getUserByPhoneNumber()` to try BSUID first, then fall back to phone
3. Update `receiveMessage.from` handling to work with empty strings when BSUID is present
4. Update send methods to use `recipient` field when BSUID is available

### Phase 3 — Full BSUID Support

1. Handle `user_changed_user_id` system webhooks
2. Add `REQUEST_CONTACT_INFO` template button for users without phone numbers
3. Update auth flow to handle BSUID-only users (no phone number for OAuth)
4. Consider making `bsuid` NOT NULL in a future migration once all active users have been mapped

### Phase 4 — Phone Number Deprecation (future)

Once BSUIDs are fully populated and the Contact Book is reliable, consider:
- Making `bsuid` the primary lookup key
- Making `phone_number` nullable on `users` and `chats`
- Keeping phone number support as a fallback for as long as the WhatsApp API accepts it
