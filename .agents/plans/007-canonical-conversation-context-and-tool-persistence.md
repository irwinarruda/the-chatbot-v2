# Plan 007: Canonical Conversation Context and Tool Persistence

## Problem

The current chat model persists user-visible messages but not the complete LLM
conversation. Tool calls and tool results exist only inside one in-memory
provider loop. After the final assistant response is persisted, the application
cannot reconstruct which tools were requested, which arguments were used, or
whether each operation succeeded.

Compaction has a related limitation. It runs after a fixed number of messages,
stores one plain-text profile summary on `Chat`, and removes all summarized
messages from the next LLM context. Message count is not a useful approximation
of context-window usage, and the current summary intentionally excludes tool
operations. This can make later model responses unaware of confirmed or failed
actions.

The implementation should preserve the existing generic `Chat` and `Message`
model instead of introducing a parallel agent-run domain. `Message` should
become the canonical ordered conversation item for channel content, model-only
tool calls, and model-only tool results. `Chat` remains the aggregate root and
owns the current `ConversationSummary` value.

## Goal

Create one durable, provider-neutral conversation history that can:

1. Represent user, assistant, and tool participation.
2. Persist tool calls before execution and tool results after execution.
3. Preserve structured success, failure, and uncertain outcomes.
4. Reconstruct valid OpenAI and Anthropic contexts after the request ends.
5. Keep internal tool messages out of WhatsApp and web-facing APIs.
6. Compact history according to context-window pressure rather than message
   count.
7. Preserve recent complete turns verbatim while carrying compacted user
   profile and durable facts forward.
8. Keep provider translation in `AiChatGateway` and application orchestration
   in `MessagingService`.
9. Avoid introducing `AgentRun`, `AgentRunStep`, repository, or event-sourcing
   abstractions in this first version.

## Non-Goals

- Do not build a general-purpose agent framework.
- Do not add long-running background agents or resumable job scheduling.
- Do not persist chain-of-thought or hidden model reasoning.
- Do not expose tool arguments or results to normal web/WhatsApp clients.
- Do not build semantic retrieval, embeddings, or vector memory.
- Do not solve every cross-request semantic duplicate. The first version must
  prevent duplicate execution of the same persisted tool call; broader intent
  deduplication can follow from production evidence.
- Do not add route, controller, gateway, or infrastructure tests to the default
  Vitest suite. Repository rules allow application tests only.
- Do not remove legacy message columns in the same rollout that introduces the
  canonical content format.

## Current Architecture Findings

The current flow is:

```text
Inbound channel message
  -> MessagingService creates Message
  -> Message is persisted
  -> Chat.summary + Chat.effectiveMessages become AiChatMessage[]
  -> AiChatGateway calls OpenAI or Anthropic
  -> AiChatGateway executes tools in an in-memory loop
  -> final assistant text returns to MessagingService
  -> only the final channel Message is persisted
  -> summarization may replace all effective raw messages with one string
```

Important consequences:

- `Message` currently describes channel payloads: text, buttons, and audio.
- `AiChatMessage` is a second, lossy conversation representation.
- Tool execution is coupled to the LLM resource through direct dependencies on
  `CashFlowService`, `AuthService`, and `TodoService`.
- Tool errors are serialized into strings instead of becoming typed outcomes.
- OpenAI and Anthropic tool items are constructed only inside the provider
  request loop and cannot be replayed later.
- The provider loop has no explicit maximum number of rounds.
- OpenAI tool arguments are parsed without converting malformed JSON into a
  persisted failed tool result.
- `Chat.shouldSummarize()` uses message count rather than token pressure.
- `ConversationSummary` is currently a plain string and is inserted into the
  model context as a system-role message.
- Summarization errors are silently swallowed.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Aggregate root | Keep `Chat` | Conversation history and compaction are one consistency boundary |
| Canonical history item | Evolve `Message` | Avoid a parallel `AgentRunStep` hierarchy and keep one ordered transcript |
| Message payload | Discriminated `MessageContent` union | Prevent a growing bag of unrelated optional properties |
| Conversation grouping | Add `turnId` | Keeps a user turn, tool calls, results, and final response atomic during compaction |
| Ordering | Add database-generated `sequence` | Timestamps alone are not a safe deterministic cursor |
| Visibility | Add `audience` | Separates channel-visible messages from model-only execution items |
| Roles | `User`, `Assistant`, `Tool` | Provider-neutral roles; adapters handle Anthropic/OpenAI wire differences |
| Compaction state | `Chat.summary?: ConversationSummary` | Summary content and its cursor cannot become inconsistent independent fields |
| Summary shape | `userProfile`, `durableFacts`, cursor, version | Smallest useful structured memory for the first version |
| Compaction trigger | Token budget | Context pressure depends on token size, not message count |
| Recent continuity | Retain complete recent turns | Active work remains verbatim without adding `openThreads` yet |
| Tool orchestration | `MessagingService` | It already owns the respond-to-message use case |
| Tool execution | New `AiToolService` | Application tools should not execute inside an external-provider gateway |
| Provider responsibility | Translate canonical messages and call the provider | Keeps OpenAI/Anthropic protocol details at the resource boundary |
| Persistence | SQL remains in `MessagingService` | Matches the project rule against repositories |
| Legacy rollout | Expand, backfill, cut over, clean up later | Avoid destructive schema and application changes in one release |

## Target Domain Model

### Message Roles

Add `src/shared/entities/enums/MessageRole.ts`:

```typescript
export const MessageRole = {
  User: "User",
  Assistant: "Assistant",
  Tool: "Tool",
} as const;
export type MessageRole = ValueOf<typeof MessageRole>;
```

Mapping rules:

- Inbound user content uses `User`.
- Final assistant replies and assistant tool calls use `Assistant`.
- Tool results use `Tool`.
- System prompts and conversation memory are request context, not persisted
  conversational messages.

### Message Audience

Add `src/shared/entities/enums/MessageAudience.ts`:

```typescript
export const MessageAudience = {
  Channel: "Channel",
  Model: "Model",
  Both: "Both",
} as const;
export type MessageAudience = ValueOf<typeof MessageAudience>;
```

Expected usage:

| Message | Audience |
|---|---|
| Inbound text/button/audio | `Both` |
| Final assistant reply | `Both` |
| Temporary “processing audio” notice | `Channel` |
| Assistant tool call | `Model` |
| Tool result | `Model` |

`Chat.toJSON()` and channel-facing APIs must include only `Channel` and `Both`
messages. Model context includes only `Model` and `Both` messages.

### Message Content

Replace the application-level optional payload bag with one discriminated
union. Tool calls and results are message content, not independent entities or
DTO families. Keep the first version explicit and limited to current
capabilities:

```typescript
export type MessageContent =
  | { type: "text"; text: string }
  | { type: "button"; text: string; options?: string[] }
  | {
      type: "audio";
      mediaId?: string;
      mediaUrl?: string;
      mimeType: string;
      transcript?: string;
    }
  | {
      type: "toolCall";
      callId: string;
      name: string;
      arguments: unknown;
    }
  | {
      type: "toolResult";
      callId: string;
      outcome:
        | { status: "succeeded"; data: unknown }
        | { status: "failed"; code: string; message: string }
        | { status: "unknown"; code: string; message: string };
    };
```

Use `unknown` only at the generic tool boundary. Keeping raw arguments as
`unknown` allows malformed provider input to be persisted and converted into a
failed result instead of crashing before the call is recorded. Each registered
tool validates its input before invoking application behavior.

Do not add `ToolCall`, `ToolResult`, or `ToolError` entities. Do not create
separate provider, execution, and persistence DTOs for the same information.
Provider-specific request types remain local to `AiChatGateway`; the canonical
`MessageContent` shape crosses the application boundary.

### Message Entity

Evolve `src/shared/entities/Message.ts` toward:

```typescript
export interface MessageConfig {
  idChat: string;
  turnId: string;
  role: MessageRole;
  audience: MessageAudience;
  content: MessageContent;
  channelMessageId?: string;
}

export class Message {
  id: string;
  idChat: string;
  turnId: string;
  sequence?: number;
  role: MessageRole;
  audience: MessageAudience;
  content: MessageContent;
  channelMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

`sequence` is absent until the message is inserted and hydrated from the
database. Do not invent a local sequence from `messages.length`.

Recommended behavior:

- Content-specific state changes remain entity methods. For example, audio
  transcription may only update content whose `type` is `audio`.
- `toJSON()` returns only channel-safe content and never serializes tool calls
  or tool results to normal clients.
- Do not preserve compatibility getters such as `message.text` indefinitely.
  They may exist during migration but should be removed after call sites use the
  discriminated content.
- Validate required content when constructing each message. The discriminated
  `outcome` prevents success data and failure information from coexisting.

### ConversationSummary Value Object

Add `src/shared/entities/ConversationSummary.ts` or colocate the value type with
`Chat` if it remains small:

```typescript
export interface ConversationSummary {
  userProfile: string[];
  durableFacts: string[];
  compactedThroughSequence: number;
  version: number;
}
```

Meanings:

- `userProfile`: identity, preferences, communication style, and recurring
  behavior.
- `durableFacts`: confirmed decisions, constraints, external state, and tool
  outcomes that matter in future turns.
- `compactedThroughSequence`: highest message sequence represented by this
  summary.
- `version`: summary schema/prompt version, not database optimistic concurrency.

`ConversationSummary` is a value object owned by `Chat`; it has no independent
identity or lifecycle.

### Chat Entity

Replace `summary?: string` and `summarizedUntilId?: string` with:

```typescript
export class Chat {
  messages: Message[];
  summary?: ConversationSummary;
}
```

Add behavior that expresses domain transitions:

- `addUserTextMessage()`
- `addUserButtonMessage()`
- `addUserAudioMessage()`
- `addAssistantTextMessage()`
- `addAssistantButtonMessage()`
- `addAssistantToolCall()`
- `addToolResult()`
- `setSummary()`
- `getChannelMessages()`
- `getModelMessages()`
- `getUncompactedTurns()`

Invariants:

1. The initial inbound message starts a turn using its own message ID as
   `turnId`.
2. All tool calls, tool results, and assistant replies generated from that
   inbound message use the same `turnId`.
3. A tool result must reference an earlier tool call in the same chat and turn.
4. A tool result cannot claim success and contain an error simultaneously.
5. `setSummary()` must reject a cursor older than the current summary cursor.
6. `setSummary()` must reject a cursor that is not present in the current
   persisted/hydrated chat history.
7. Compaction must advance only through complete turns.
8. Channel-only messages are never included in model context.
9. Model-only messages are never exposed through normal chat serialization.

Do not make `Chat` execute tools, call providers, calculate token counts, or run
SQL. Those remain application or resource concerns.

## Database Migration

Create a migration with:

```bash
bun run migrate:create -- canonical-conversation-items
```

### Expand Message Storage

Add columns to `messages`:

```sql
ALTER TABLE messages ADD COLUMN sequence BIGINT GENERATED ALWAYS AS IDENTITY;
ALTER TABLE messages ADD COLUMN turn_id UUID;
ALTER TABLE messages ADD COLUMN role VARCHAR(16);
ALTER TABLE messages ADD COLUMN audience VARCHAR(16);
ALTER TABLE messages ADD COLUMN content JSONB;
```

Add indexes after backfill:

```sql
CREATE UNIQUE INDEX "UX_messages_sequence" ON messages (sequence);
CREATE INDEX "IX_messages_chat_sequence" ON messages (id_chat, sequence);
CREATE INDEX "IX_messages_chat_turn" ON messages (id_chat, turn_id, sequence);
```

Use a global database-generated sequence. The cursor only needs deterministic
ordering, not a gapless per-chat counter. Queries still scope by `id_chat`.

### Backfill Existing Messages

Backfill deterministically:

- `turn_id = id` for existing user messages.
- Existing assistant messages should join the closest preceding user message in
  the same chat. Use SQL ordered by `created_at, id`; do not infer from array
  position in application startup.
- Existing user types map to `role = User` or `Assistant`.
- Existing user and final assistant content maps to `audience = Both`.
- Known processing-only assistant templates may map to `Channel` if they can be
  identified safely. Otherwise retain `Both` during migration and correct new
  messages going forward.
- Build `content` JSONB from existing text, button, or audio columns.

After verifying the backfill, make `turn_id`, `role`, `audience`, and `content`
non-null.

### Expand Chat Summary Storage

Add:

```sql
ALTER TABLE chats ADD COLUMN conversation_summary JSONB;
```

For chats with an existing summary and valid `summarized_until_id`:

1. Resolve the summarized message's new sequence.
2. Backfill `conversation_summary` with:

```json
{
  "userProfile": ["<legacy summary>"],
  "durableFacts": [],
  "compactedThroughSequence": 123,
  "version": 1
}
```

The legacy summary cannot be reliably split into profile and durable facts in
SQL. Preserving it as one profile item is safer than guessing.

Keep `chats.summary` and `chats.summarized_until_id` for one compatibility
release. Stop writing them after the new code is deployed. Remove them only in
a later cleanup migration after production verification.

### Down Migration

The down migration may drop the new indexes and columns. It does not need to
reverse tool messages into legacy columns because old versions cannot represent
them. Document that rollback after new tool messages exist requires deploying a
compatibility reader or restoring from backup.

## Application Flow

### Canonical Response Loop

Keep the use case in `MessagingService.respondToMessage()`:

```text
Build token-budgeted context from Chat
  -> IAiChatGateway generates assistant output
  -> if assistant text/button:
       persist Message(Both)
       send through channel gateway
       finish
  -> if tool calls:
       persist every Message(toolCall, Model) before execution
       execute each through AiToolService
       persist every Message(toolResult, Model)
       rebuild context
       call IAiChatGateway again
  -> stop at configured maximum tool rounds
```

Tool call and result persistence must happen before the next provider request.
If the provider returns multiple tool calls, persist all calls first, then
execute them. Execute sequentially in the first version because several tools
mutate shared financial state and ordering can matter.

### Tool Result Semantics

Use these statuses consistently:

- `succeeded`: the application received authoritative confirmation that the
  operation completed.
- `failed`: the application knows the operation did not complete.
- `unknown`: the operation may have completed, but confirmation was lost.

Never automatically retry a mutating `unknown` result. The assistant should
tell the user the outcome could not be confirmed and offer a safe verification
step.

Malformed arguments, unknown tool names, validation failures, and business
errors become persisted `failed` tool results. They must not abort the entire
conversation loop before the model observes the failure.

### Persisted Call Reuse

Before executing a tool call, query for an existing result with the same
`id_chat`, `turn_id`, and `callId`:

- Existing `succeeded`: reuse it and do not execute again.
- Existing `failed`: return the recorded failure unless the model creates a new
  corrected tool call.
- Existing `unknown`: do not execute automatically.
- No result: execute and persist the outcome.

Add a maximum tool-round configuration with a conservative default such as 5.
When reached, persist/send a concise failure response instead of continuing an
unbounded provider loop.

## AiToolService

Move tool execution out of `AiChatGateway` into
`src/server/services/AiToolService.ts`.

Responsibilities:

- Own the application tool registry.
- Expose provider-neutral tool definitions.
- Validate arguments before invoking a use case.
- Resolve the authenticated user from trusted chat/channel context instead of
  trusting model-supplied identity whenever possible.
- Coordinate `CashFlowService`, `AuthService`, and `TodoService` operations.
- Return canonical `toolResult` message content directly.
- Never format results as assistant prose.

Suggested contract:

```typescript
export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

type ToolCallContent = Extract<MessageContent, { type: "toolCall" }>;
type ToolResultContent = Extract<MessageContent, { type: "toolResult" }>;

execute(
  call: ToolCallContent,
  chat: Chat,
  sourceMessage: Message,
): Promise<ToolResultContent>;
```

`ToolCallContent` and `ToolResultContent` are local aliases derived from the
canonical union, not new DTO representations. Inline the `Extract` expressions
if the aliases are used only once.

Each tool uses a Zod schema as the application source of truth. Add a small
translation from the schema/registered definition into OpenAI and Anthropic
tool declarations. Avoid maintaining unrelated handwritten validation and
provider schemas.

Do not make tool descriptions responsible for enforcing correctness. Prompt
instructions improve model behavior; validation, persistence, and tool-result
status enforce application behavior.

## IAiChatGateway and Provider Translation

Change `IAiChatGateway` so it no longer executes application tools. It should:

- Receive canonical context messages selected by the application.
- Receive provider-neutral available tool definitions.
- Return assistant content and/or canonical tool-call requests.
- Return finish reason and token usage when the provider supplies them.
- Generate a structured `ConversationSummary` candidate.

Suggested response shape:

```typescript
export interface AiChatResponse {
  content?: Extract<MessageContent, { type: "text" | "button" }>;
  toolCalls: Extract<MessageContent, { type: "toolCall" }>[];
  finishReason: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}
```

The only tool-related public boundary contracts should be `AiToolDefinition`
and `AiChatResponse`. Everything else is the canonical `MessageContent` union
or a locally inferred/derived type.

### OpenAI Adapter

- `Assistant` text maps to assistant content.
- `Assistant` `toolCall` maps to `assistant.tool_calls`.
- `Tool` `toolResult` maps to `role: "tool"` with `tool_call_id`.
- Structured results serialize as JSON only at the provider boundary.
- Preserve every provider tool call ID as canonical `callId`.

### Anthropic Adapter

- `Assistant` `toolCall` maps to an assistant `tool_use` content block.
- `Tool` `toolResult` maps to a user `tool_result` content block referencing
  the original `tool_use_id`.
- Consecutive canonical items may need grouping into one Anthropic message.
- Do not change the canonical role to match Anthropic's wire-level use of the
  user role for tool results.

Provider adapters must reject impossible canonical sequences rather than
silently dropping unsupported items.

## Context Window and Compaction

### Configuration

Replace `SUMMARIZATION_MESSAGE_COUNT_THRESHOLD` with explicit budget settings:

```text
AI_CONTEXT_WINDOW_TOKENS
AI_MAX_OUTPUT_TOKENS
AI_CONTEXT_SAFETY_MARGIN_TOKENS
AI_MIN_RECENT_TURNS
AI_MAX_TOOL_ROUNDS
```

Keep context-window size in configuration rather than hardcoding a model-name
table that will drift. Validate that reserved output and safety tokens leave a
positive input budget.

For the first version, use one conservative provider-neutral token estimator,
clearly named as an estimate. Calibrate it against provider-reported input usage
captured from real requests. An exact tokenizer can replace it later without
changing the context selection model.

### GLM-5.1 Environment Reference

GLM-5.1 exposes an OpenAI-compatible Chat Completions API. For this general
chatbot application, use the general API endpoint rather than the Coding Plan
endpoint.

Reference configuration for the global Z.AI platform:

```dotenv
AI_PROVIDER=glm
AI_API_KEY=your-zai-api-key
AI_MODEL=glm-5.1
AI_BASE_URL=https://api.z.ai/api/paas/v4/

AI_CONTEXT_WINDOW_TOKENS=204800
AI_MAX_OUTPUT_TOKENS=4096
AI_CONTEXT_SAFETY_MARGIN_TOKENS=8192
AI_MIN_RECENT_TURNS=4
AI_MAX_TOOL_ROUNDS=5
```

Reference configuration for an API key issued by the mainland China BigModel
platform:

```dotenv
AI_PROVIDER=glm
AI_API_KEY=your-bigmodel-api-key
AI_MODEL=glm-5.1
AI_BASE_URL=https://open.bigmodel.cn/api/paas/v4/

AI_CONTEXT_WINDOW_TOKENS=204800
AI_MAX_OUTPUT_TOKENS=4096
AI_CONTEXT_SAFETY_MARGIN_TOKENS=8192
AI_MIN_RECENT_TURNS=4
AI_MAX_TOOL_ROUNDS=5
```

Official GLM-5.1 limits are a 204,800-token context window and a 131,072-token
maximum output. `AI_MAX_OUTPUT_TOKENS=4096` is an intentional application limit
for concise chat responses, not the model maximum. Increase it only for a real
product requirement because it directly reduces the input-history budget.

Coding Plan subscribers may see these dedicated endpoints:

```text
Global: https://api.z.ai/api/coding/paas/v4/
China:  https://open.bigmodel.cn/api/coding/paas/v4/
```

The official documentation says the Coding endpoint is intended for supported
coding tools and recommends the general endpoint for other scenarios. Do not
carry forward the older `/coding/paas/v3` development example currently
commented in local environment configuration.

References:

- [GLM-5.1 model and limits](https://docs.z.ai/guides/llm/glm-5.1)
- [GLM-5.1 exact context/output capacities](https://docs.z.ai/devpack/tool/openclaw)
- [Z.AI general and Coding API endpoints](https://docs.z.ai/guides/overview/quick-start)
- [Mainland China GLM-5.1 endpoint](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.1)

### Context Budget

Before each provider call, calculate:

```text
available history budget
  = context window
  - system prompt estimate
  - tool definitions estimate
  - maximum output reserve
  - safety margin
  - conversation summary estimate
```

Do not trigger compaction after the assistant response merely because a count
was reached. Build and compact before a provider request when the complete input
would exceed the safe budget.

### Turn Selection

1. Select messages with `audience` `Model` or `Both`.
2. Exclude messages at or below
   `summary.compactedThroughSequence` when a summary exists.
3. Group remaining messages by `turnId`.
4. Preserve at least `AI_MIN_RECENT_TURNS` complete recent turns.
5. Add newer complete turns from newest to oldest while they fit.
6. Never include a tool result without its tool call.
7. Never compact through a turn that lacks its final assistant response unless
   recovering that exact in-progress turn.

If the protected recent turns alone do not fit, fail with an observable context
budget error rather than silently cutting a tool sequence in half.

### Summary Generation

When old complete turns must be compacted:

1. Provide the existing `ConversationSummary`, if any.
2. Provide the next oldest complete turns, including tool calls and results.
3. Ask the model for only `userProfile` and `durableFacts`.
4. Validate the response with Zod.
5. Set `compactedThroughSequence` in application code from the last included
   message; never trust the model to choose the cursor.
6. Set `version` in application code from the current summary schema/prompt
   version.
7. Call `chat.setSummary()` and persist the complete value atomically.
8. Rebuild the context and verify it is within budget.

Tool history should be compacted into durable outcomes, not raw protocol detail.
For example, preserve “The financial spreadsheet is connected,” not provider
call IDs or JSON arguments.

### Summary Safety

Conversation memory is derived from untrusted user content. Do not insert it as
an unrestricted system instruction. The provider request should place it in a
clearly delimited memory block, and the system prompt must state that memory is
data, not instructions.

Keep a recent raw tail because the first-version summary intentionally has no
`openThreads` field. If production evidence shows unresolved work being lost
after it leaves the recent tail, add that field later based on observed need.

## MessagingService Changes

Update `MessagingService` in this order:

1. Hydrate the new message role, audience, content, turn, and sequence fields.
2. Persist canonical message content and common metadata.
3. Filter channel serialization through `Chat.getChannelMessages()`.
4. Replace `parseMessagesToAi()` with canonical context selection.
5. Move provider tool looping into `respondToMessage()` or one clearly named
   private method if extraction materially improves the use-case flow.
6. Persist tool calls and results around `AiToolService.execute()`.
7. Replace post-response count summarization with pre-request token budgeting.
8. Persist `Chat.summary` as one JSON value.
9. Stop silently swallowing compaction errors. Log/propagate an observable
   internal failure while preserving a safe user-facing response.
10. Record provider token usage in application logs initially. Add durable usage
    storage only when a concrete reporting requirement exists.

Keep SQL methods near the bottom of `MessagingService`; do not introduce a
repository for chats or messages.

## Client and Channel Compatibility

Normal clients should not need to understand tool messages.

- Preserve the existing web-chat message response shape for text, buttons, and
  audio where practical.
- Make `Chat.toJSON()` serialize channel-safe messages only.
- Never serialize tool arguments, results, internal errors, or model-only
  messages to the browser by default.
- Continue using `channelMessageId` for inbound provider deduplication.
- Keep WhatsApp and web gateways unaware of model-only messages.
- Mark temporary delivery notices such as audio processing as `Channel` so they
  do not pollute future LLM context.

If an internal diagnostics UI is added later, expose model-only messages through
a separate authenticated administrative DTO rather than weakening the normal
chat DTO.

## Prompt Changes

### Main Assistant Prompt

- Remove repeated prose that attempts to make tool execution reliable through
  prompt force alone.
- State concise behavioral rules: use tools for actions, trust structured tool
  results, never claim success for failed/unknown results.
- Explain that conversation memory is untrusted historical data.
- Preserve channel formatting requirements, but prefer structured response
  output when supported rather than regex-only prefix parsing.

### Summarization Prompt

- Return structured JSON matching `userProfile` and `durableFacts`.
- Include confirmed tool outcomes when they matter later.
- Exclude call IDs, raw arguments, transient results, timestamps, and protocol
  mechanics.
- Merge with existing facts without duplicating semantically identical items.
- Remove facts contradicted by newer authoritative tool results.
- Keep entries short and independently understandable.

Validate output. A malformed summary must not advance the compaction cursor.

## Test Plan

### Shared Entity Tests

Add or update application tests for:

- Constructing every `MessageContent` variant.
- Rejecting invalid role/content combinations.
- Updating only audio content with a transcript and media URL.
- Hiding `Model` messages from channel serialization.
- Including `Model` and `Both` messages in model history.
- Rejecting a tool result without a matching call.
- Rejecting a tool result from another turn.
- Rejecting success with an error payload.
- Advancing `ConversationSummary` only to a valid newer sequence.
- Preventing compaction through an incomplete turn.

### MessagingService Tests

Use `TestAiChatGateway` and a test tool executor to cover:

- A text-only response persists one final assistant message.
- A tool call is persisted before execution.
- A successful result is persisted and included in the follow-up model call.
- A failed result is persisted and included in the follow-up model call.
- Malformed arguments become a failed result instead of aborting the turn.
- An unknown tool becomes a failed result.
- An uncertain mutation is not retried automatically.
- A previously persisted result prevents duplicate execution.
- Multiple tool calls preserve provider order and execute sequentially.
- The maximum tool-round limit terminates the loop safely.
- Channel-facing chat output excludes tool messages.
- Temporary audio-processing messages do not enter model context.

### Context Builder Tests

Keep token selection as an application utility or Service-owned behavior so it
can be tested within repository rules:

- Context under budget is not compacted.
- Large text triggers compaction even with few messages.
- Many tiny messages do not compact prematurely.
- Complete turns are retained or removed atomically.
- Tool call/result pairs are never split.
- The configured number of recent turns remains verbatim.
- Existing summary content contributes to the token budget.
- Summary cursor advances to the last compacted sequence.
- Malformed summary output does not advance the cursor.
- Rebuilt context fits the configured safe budget.
- Summary content is represented as data, not a conversational system command.

### Provider Verification

Gateway tests are not allowed in the default suite. Verify adapters through a
small manual or development-only matrix:

| Scenario | OpenAI | Anthropic |
|---|---|---|
| Text-only reply | Required | Required |
| One tool call/result | Required | Required |
| Multiple tool calls | Required | Required |
| Failed tool result | Required | Required |
| Compacted conversation | Required | Required |

Document the observed provider request/response shape without logging secrets or
private conversation contents.

## Implementation Sequence

### Phase 1: Canonical Domain and Expand Migration

1. Add message role/audience enums and content union.
2. Add `ConversationSummary` value object.
3. Evolve `Message` and `Chat` behavior while retaining temporary legacy
   compatibility accessors.
4. Create the expand/backfill migration.
5. Hydrate and persist both canonical and legacy-compatible data during the
   transition.
6. Update entity tests.

Exit condition: existing text, button, audio, WhatsApp, and web flows behave as
before using canonical messages.

### Phase 2: Durable Tool Conversation

1. Add `AiToolService` and structured tool definitions/results.
2. Remove business-service dependencies from `AiChatGateway`.
3. Change `IAiChatGateway` to return canonical tool calls rather than executing
   them.
4. Move the tool loop into `MessagingService`.
5. Persist each call before execution and each result afterward.
6. Add maximum-round and persisted-result reuse behavior.
7. Add service tests for success, failure, uncertainty, and duplication.

Exit condition: a later model call and a later user turn can reconstruct exactly
which tool ran and what authoritative outcome it produced.

### Phase 3: Token-Budgeted Context

1. Add context budget configuration and validation.
2. Add conservative token estimation.
3. Group model messages into complete turns.
4. Build context from summary plus the newest complete turns that fit.
5. Record provider-reported usage for estimator calibration.
6. Add context-selection tests.

Exit condition: every model request is assembled under an explicit safe token
budget without splitting turns or tool pairs.

### Phase 4: Structured Compaction

1. Replace the summarization prompt with structured profile/facts output.
2. Validate summary output.
3. Set cursor/version in application code.
4. Persist the entire `ConversationSummary` value atomically on `Chat`.
5. Remove count-based summarization and silent error swallowing.
6. Verify compaction against both providers.

Exit condition: old raw turns can leave active context while durable user and
application facts remain available, and recent turns stay verbatim.

### Phase 5: Cleanup

After production verification:

1. Remove temporary legacy `Message` getters and dual writes.
2. Remove unused `AiChatMessage` mapping types.
3. Remove legacy summary columns in a separate migration.
4. Remove old message payload columns only after confirming no rollback or
   reporting path depends on them.
5. Update README architecture and environment documentation.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Tool messages leak to clients | Audience filtering in entity serialization plus service tests |
| Provider protocols diverge | Preserve canonical roles and isolate wire grouping in the gateway |
| Duplicate mutating execution | Persist before execute and reuse existing results by chat/turn/call ID |
| Unknown external outcome retried | Represent `unknown` explicitly and forbid automatic mutation retry |
| Invalid summary advances cursor | Validate first; set cursor only in application code after success |
| Summary prompt injection gains authority | Treat summary as delimited untrusted data, not instructions |
| Recent unfinished work disappears | Protect complete recent turns; add `openThreads` only if evidence demands it |
| Token estimate is inaccurate | Safety margin plus calibration against provider usage |
| Migration misgroups legacy turns | Deterministic SQL ordering and pre/post migration validation queries |
| `MessagingService` becomes larger | Extract only the cohesive `AiToolService`; avoid speculative agent layers |
| Rollback loses canonical tool items | Expand-first rollout and delayed legacy-column removal |

## Validation

Run after each phase:

```bash
bun run typecheck
bun run check
bun run test
```

The PostgreSQL-backed suite requires the configured test database and will reset
its schema according to the repository test rules.

Before declaring the implementation complete, verify:

1. Existing WhatsApp and web text/button/audio behavior still works.
2. Tool calls and results survive process boundaries and chat hydration.
3. A failed tool cannot reappear in history as a successful result.
4. Reprocessing a persisted call does not repeat its mutation.
5. Normal clients never receive model-only content.
6. OpenAI and Anthropic receive valid native tool-call/result sequences.
7. Context selection stays under the configured budget.
8. Compaction never splits a turn or tool pair.
9. Summary cursor/version/content update together.
10. Old summaries and messages survive migration without disappearing.

## Completion Criteria

This plan is complete when the application has one canonical `Chat.messages`
history containing channel and model conversation items; tool execution outcomes
are durable and replayable; provider gateways only translate/call providers;
normal clients remain unaware of internal tool messages; and context is built
from structured conversation memory plus recent complete turns under an
explicit token budget.
