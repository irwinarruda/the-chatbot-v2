# Plan 008: Pi Agent Core Integration

## Goal

Replace the provider-specific chat and manually coordinated tool loop with
`@earendil-works/pi-agent-core` and `@earendil-works/pi-ai`, while preserving
this application's PostgreSQL conversation history, domain entities, tool
outcome semantics, compaction memory, and channel delivery behavior.

The integration should remove agent-runtime infrastructure from
`AiChatGateway` and `MessagingService` without handing conversation ownership
to Pi's coding-agent session system.

## Decision

Use:

- `@earendil-works/pi-ai` for model lookup, provider normalization, message
  translation, streaming, usage, and direct text generation.
- `@earendil-works/pi-agent-core` for the stateful model/tool loop, tool
  lifecycle, argument validation, event streaming, and execution ordering.

Do not use `@earendil-works/pi-coding-agent` as the application runtime.
Specifically, do not adopt its JSONL `SessionManager`, coding tools, cwd-based
resource discovery, default coding compaction summaries, TUI, skills, or prompt
system.

Pin exact Pi package versions after the spike. Do not use a floating `^0.x`
range.

## Context

The canonical conversation branch introduced the correct application boundary:

```text
Chat
  -> ordered Message entities
  -> turn grouping
  -> channel/model audiences
  -> structured tool calls and results
  -> ConversationSummary with a durable database cursor
```

That work remains necessary. Pi should replace infrastructure inside the AI
resource boundary, not replace the domain model or become a second persistence
system.

The current flow is approximately:

```text
MessagingService
  -> build model context
  -> IAiChatGateway provider call
  -> inspect tool calls
  -> persist calls
  -> execute through AiToolService
  -> persist results
  -> repeat until final response or round limit
  -> persist and send the final channel response
```

The target flow is:

```text
MessagingService
  -> compact application context when required
  -> create application-bound tool definitions
  -> IAiChatGateway.runAgent()
       -> create one ephemeral Pi Agent
       -> hydrate Pi context from canonical Messages
       -> run provider/tool loop
       -> notify application before tool execution
       -> delegate tool execution to application callbacks
       -> return final assistant response
  -> persist and send the final channel response
```

PostgreSQL remains the only source of truth. A Pi `Agent` is created per AI
response run and disposed after completion. The DI resource may remain a
singleton, but it must not keep one shared mutable Agent across chats.

## Non-Goals

- Do not persist Pi JSONL sessions.
- Do not introduce a second conversation or agent-run aggregate.
- Do not move SQL into a Resource.
- Do not make `AiChatGateway` depend on `AiToolService` or other application
  Services.
- Do not expose Pi message types to shared entities, controllers, clients, or
  channel gateways.
- Do not replace the application `ConversationSummary` in the first migration.
- Do not migrate every application DTO from Zod to TypeBox preemptively.
- Do not add Pi coding tools, filesystem access, shell access, skills, or
  extensions to the assistant.
- Do not change WhatsApp or web response behavior as part of the integration.

## Target Boundaries

### MessagingService

`MessagingService` continues to own the respond-to-message use case:

- Load and persist `Chat` and `Message` entities.
- Transcribe inbound audio.
- Run context-budget checks and application compaction.
- Build tool execution callbacks with the active `Chat` and source `Message`.
- Persist tool calls before their side effects begin.
- Reuse a previously persisted tool result instead of executing it twice.
- Persist tool results before returning them to the model.
- Persist and deliver the final assistant response.
- Send the existing tool-round-limit and unexpected-error messages.

It should no longer manually translate provider messages or coordinate each
provider/tool round itself.

### IAiChatGateway

Evolve the AI Resource contract from a single provider round into one complete
agent response run. The exact names may follow the surrounding implementation,
but the contract should represent:

```ts
interface AiAgentRequest {
  channelAddress: string;
  messages: AiChatContextMessage[];
  tools: AiToolDefinition[];
  memory?: ConversationSummary;
  maxToolRounds: number;
  onToolCalls(calls: ToolCallContent[]): Promise<void>;
  executeTool(call: ToolCallContent): Promise<ToolResultContent>;
}

interface AiAgentResponse {
  content?: AssistantChannelContent;
  finishReason: string;
  usage?: AiUsage;
  toolRounds: number;
}
```

The gateway receives passive tool definitions and one application execution
callback. It adapts the definitions into Pi `AgentTool` objects and delegates
every requested execution through that callback. This keeps Pi types and
concrete application Services out of each other's layers.

This is illustrative rather than a required final shape. Keep callback and tool
execution contracts application-neutral enough that the Resource does not
import concrete Services or perform SQL.

The gateway should also retain provider-backed capabilities used outside the
main agent loop:

- Direct text generation.
- Structured conversation summary generation.
- Input-size estimation or the existing context-budget contract.

### AiChatGateway

Replace direct OpenAI and Anthropic SDK orchestration with a Pi-backed
implementation.

Responsibilities:

- Configure only the selected providers needed by the application.
- Resolve the configured model from `AiConfig`.
- Convert canonical application context into Pi messages.
- Convert application tool definitions into Pi `AgentTool` definitions.
- Create one Agent per response run.
- Set `toolExecution` to sequential.
- Subscribe to Agent lifecycle events.
- Await `onToolCalls` after an assistant message containing tool calls and
  before Pi begins tool preflight or execution.
- Return each application `ToolResultContent` to Pi as model-readable content
  while retaining the structured outcome in tool-result details.
- Convert the final assistant text through `AssistantTextParser`.
- Normalize Pi usage and stop reasons into application types.
- Dispose subscriptions and Agent state in `finally`.

### AiToolService

Keep `AiToolService` as a deliberately thin application tool registry and
executor. Do not move its business behavior into `AiChatGateway`; that would
couple Pi/provider adaptation to `AuthService`, `CashFlowService`, and
`TodoService`.

Its public surface should remain approximately:

```ts
class AiToolService {
  getDefinitions(): AiToolDefinition[];

  execute(
    call: ToolCallContent,
    context: AiToolContext,
  ): Promise<ToolResultContent>;
}
```

Responsibilities remain:

- Define tool names, descriptions, schemas, and mutation metadata.
- Resolve the requested application tool.
- Validate arguments with the existing Zod DTO.
- Delegate to `AuthService`, `CashFlowService`, and `TodoService`.
- Preserve succeeded, failed, and unknown outcomes.
- Distinguish uncertain mutating operations from confirmed failures.

Pi owns the model/tool loop, provider-facing schema adaptation, execution
lifecycle, and delivery of results into the next model turn. `AiToolService`
owns only what each application tool means and how it executes.

Do not add Pi imports, persistence, provider translation, model-loop state, or
channel delivery to `AiToolService`. Do not add another tool abstraction unless
implementation evidence shows a concrete missing boundary.

## Conversation Mapping

Add a provider-local mapper inside `AiChatGateway`, or a server utility if the
class becomes difficult to scan. It must convert canonical messages without
changing the domain entities.

Mapping rules:

- User text becomes a Pi user message.
- User button replies become user text.
- User audio becomes its transcript and must not be sent before transcription.
- Final assistant text and buttons become assistant text blocks using the
  existing `[Text]` and `[Button]` protocol where required by the prompt.
- Consecutive assistant tool-call messages from one provider response must be
  grouped into one Pi assistant message containing multiple tool-call blocks.
- Tool results become Pi `toolResult` messages.
- The matching tool name must be resolved from the earlier canonical tool call,
  because the application tool result currently stores only `callId`.
- Successful outcomes use `isError: false`.
- Failed and unknown outcomes use `isError: true` while retaining their complete
  structured outcome in details and model-readable JSON content.
- Channel-only messages are excluded.
- Messages at or before the application compaction cursor are excluded.
- Conversation memory remains system context rather than a persisted Pi
  conversational message.

Hydrate the Agent with the complete selected transcript, including the current
persisted user message, and continue from that transcript without adding a
second copy of the user message.

Synthetic Pi metadata required to hydrate historical assistant messages must
remain local to the mapper. Do not add provider, model, API, token, or cost
fields to the shared `Message` entity solely for Pi.

## Tool Persistence and Execution

Preserve the current durability order:

```text
provider emits assistant tool calls
  -> persist every call in provider order
  -> begin tool execution
  -> reuse an existing result when present
  -> otherwise execute through AiToolService
  -> persist the structured result
  -> return the persisted result to Pi
  -> Pi performs the follow-up model turn
```

Pi Agent subscribers are awaited. Use the assistant `message_end` event as the
batch persistence barrier before tool execution. Persist all calls from that
assistant message atomically when practical.

The executable tool callback passed by `MessagingService` should:

1. Check `Chat.getToolResult(turnId, callId)`.
2. Return the existing result when one is already persisted.
3. Execute through `AiToolService` otherwise.
4. Add and persist the new tool result.
5. Return the same persisted result to the Pi adapter.

Do not persist the same result again from a later Pi lifecycle event.

## Tool Schemas

Keep Zod as the application schema source during the spike.

At the Pi boundary:

1. Convert the Zod schema with `z.toJSONSchema()`.
2. Remove unsupported top-level metadata such as `$schema` when required.
3. Adapt the JSON Schema to Pi's TypeBox-compatible tool parameter contract.
4. Continue validating inside `AiToolService` before invoking application
   behavior.

Add focused tests for the most complex existing tool DTOs. If Pi's TypeBox
validator cannot reliably consume the generated schemas, migrate only AI tool
schemas to TypeBox in a separate explicit step. Do not maintain duplicate Zod
and TypeBox definitions.

## Tool Execution Policy

Configure Pi tools for sequential execution. Parallel execution is not allowed
for the initial migration because tool batches may contain financial or other
mutating operations whose order matters.

Preserve `AI_MAX_TOOL_ROUNDS`.

Count assistant responses that contain tool calls as tool rounds. At the final
allowed round:

- Allow the tool batch to finish, matching the current behavior.
- Prevent Pi from starting another provider turn.
- Return control to `MessagingService` without a final assistant response.
- Send the existing tool-round-limit channel message.

The spike must prove the exact stop mechanism. Prefer Pi's supported termination
hooks. If the high-level Agent cannot provide a reliable round boundary, use a
small wrapper around the lower-level loop rather than removing the application
safety limit.

## Compaction Strategy

Keep compaction application-owned for the first migration.

Before creating the Pi Agent:

1. Build the canonical model-visible transcript.
2. Include system prompt, memory, and tool schema overhead in the request-size
   estimate.
3. Compact only complete old turns.
4. Preserve the configured number of recent turns.
5. Persist the `ConversationSummary` and cursor with the existing optimistic
   update behavior.
6. Rebuild the transcript after every successful compaction.

Pi receives only the already-selected transcript. Do not enable Pi Coding
Agent's automatic compaction.

The Pi-backed gateway may use Pi model metadata for the context-window limit,
but retain `AiConfig.contextWindowTokens` as an explicit override until every
configured provider and custom base URL is verified.

A later plan may evaluate Pi's cut-point and token estimation utilities. That is
not required to replace the provider and tool loop.

## Implementation Phases

### Phase 1: Dependency and Compatibility Spike

1. Add exact versions of `@earendil-works/pi-ai` and
   `@earendil-works/pi-agent-core` with Bun.
2. Do not add `@earendil-works/pi-coding-agent`.
3. Create a temporary Pi-backed Resource implementation behind the existing DI
   boundary.
4. Configure the current OpenAI, Anthropic, and GLM-compatible paths used by
   `AiConfig`.
5. Run Bun import, typecheck, Vite development, production build, and Nitro
   server smoke tests.
6. Verify the deployment target supports all transitive Node APIs.
7. Verify abort signals and request cleanup under a disconnected web stream.

Do not remove the current gateway during this phase.

### Phase 2: Conversation Mapper

1. Implement canonical-to-Pi message conversion.
2. Group multiple assistant tool calls correctly.
3. Resolve tool names for canonical results.
4. Add round-trip tests covering text, button, audio transcript, tool call,
   successful result, failed result, unknown result, and compacted history.
5. Verify the same canonical transcript is accepted by OpenAI, Anthropic, and
   the configured GLM-compatible endpoint.

### Phase 3: Read-Only Agent Run

1. Pass `AiToolService.getDefinitions()` and a bound
   `AiToolService.execute()` callback into the Pi-backed gateway.
2. Bind one read-only tool through that existing public surface.
3. Create one ephemeral Agent per response.
4. Persist the assistant tool call before execution.
5. Persist the result before returning it to Pi.
6. Complete the follow-up model turn.
7. Persist and deliver the final assistant response.
8. Confirm retries and duplicate delivery do not repeat the tool.

### Phase 4: Mutating Tool Safety

1. Bind one mutating financial tool.
2. Enforce sequential execution.
3. Preserve unknown outcomes for unconfirmed mutations.
4. Test multiple tool calls in one assistant response.
5. Prove every call is persisted before the first side effect begins.
6. Prove persisted results are reused after a simulated interruption.
7. Prove the maximum tool-round limit stops the run predictably.

### Phase 5: Replace the Manual Loop

1. Change `IAiChatGateway` to represent one complete agent run.
2. Remove `MessagingService.runAiResponseLoop()` after equivalent behavior is
   covered.
3. Register the Pi-backed gateway in `infra/bootstrap.ts`.
4. Update `tests/orquestrator.ts` with an application-level fake that does not
   depend on Pi internals.
5. Remove direct OpenAI and Anthropic chat dependencies when no other code uses
   them. Keep the OpenAI dependency if speech-to-text still requires it.
6. Delete obsolete provider translation helpers and tests.
7. Keep direct generation and structured summarization behavior covered.

### Phase 6: Cleanup and Measurement

1. Run formatting, lint, typecheck, tests, and production build.
2. Compare changed line count and responsibilities against the pre-Pi branch.
3. Confirm `MessagingService` reads as application orchestration rather than an
   agent runtime.
4. Confirm `AiChatGateway` contains provider adaptation but no SQL or business
   Service dependencies.
5. Remove temporary flags and the old implementation only after parity is
   demonstrated.
6. Document the pinned Pi version and the upgrade verification procedure.

## Testing

Application tests should cover:

- Canonical transcript conversion preserves message order.
- Channel-only messages never reach Pi.
- Compacted messages never reach Pi.
- Multiple tool calls are grouped in provider order.
- All calls persist before execution starts.
- Sequential tools execute in provider order.
- A persisted result prevents duplicate execution.
- Successful, failed, and unknown outcomes survive the Pi round trip.
- Unknown mutating outcomes are reported as errors to the model without losing
  their uncertainty semantics.
- The final assistant response is parsed as text or buttons.
- A tool-only final allowed round produces the configured fallback message.
- Provider failures produce the existing user-facing error behavior.
- Summary generation still validates malformed model output.
- Two concurrent chats do not share Agent state, tools, messages, or abort
  signals.
- One chat cannot execute a tool with another chat's bound context.

Use application fakes in the default Vitest suite. Do not add provider SDK,
route, controller, infrastructure, or live-network tests to the default run.
Provider verification should live in a manual smoke script or a separately
invoked integration test.

## Risks

| Risk | Mitigation |
|---|---|
| Pi `0.x` API churn | Pin exact versions and upgrade intentionally with mapper/tool-loop tests |
| Two conversation stores emerge | Use ephemeral Agents and keep PostgreSQL canonical |
| Stateful Agent leaks across users | Create one Agent per response and dispose in `finally` |
| Generated Zod JSON Schema is rejected by TypeBox validation | Test representative schemas before migrating; keep one schema source |
| Pi executes mutating tools concurrently | Force sequential execution globally and on sensitive tools |
| Tool-round limit becomes weaker | Prove the termination boundary before deleting the manual loop |
| Structured unknown outcomes collapse into generic errors | Store the canonical outcome in Pi result details and persist before returning |
| Pi's context shape differs from canonical rows | Keep an explicit mapper with round-trip tests |
| Historical assistant messages require Pi metadata | Synthesize it inside the Resource and do not pollute domain entities |
| Bun works locally but production bundling fails | Require Vite/Nitro production build and deployment smoke test in Phase 1 |
| Provider behavior changes during migration | Keep the old gateway available until OpenAI, Anthropic, and GLM paths pass parity checks |
| Compaction scope expands the migration | Keep current database compaction and disable Pi session compaction |

## Validation Commands

```bash
bun run format:fix
bun run check
bun run typecheck
bun run test
bun run build
```

Run the provider smoke script separately with explicit development credentials.
It must not be part of the default Vitest suite.

## Completion Criteria

The integration is complete when:

- Production uses `pi-agent-core` and `pi-ai` for chat provider calls and the
  tool loop.
- Production does not use Pi Coding Agent sessions or JSONL persistence.
- PostgreSQL remains the only durable conversation source.
- Canonical tool calls persist before execution.
- Canonical tool results persist before the model sees them.
- Mutating tools execute sequentially.
- Duplicate persisted calls do not repeat their side effects.
- Succeeded, failed, and unknown outcomes retain their existing semantics.
- The configured maximum tool rounds is enforced.
- Application compaction and optimistic summary persistence still work.
- OpenAI, Anthropic, and GLM-compatible configurations pass smoke verification.
- Web and WhatsApp response behavior remains unchanged.
- Concurrent chats use isolated Agent instances.
- The old manual provider/tool loop and obsolete provider translation code are
  removed.
- Formatting, lint, typecheck, tests, and production build pass.
