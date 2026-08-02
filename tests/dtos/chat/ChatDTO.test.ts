import { describe, expect, test } from "vitest";
import {
  parseChatMessage,
  parseChatMessages,
} from "~/modules/chat/client/services/webChatService";
import {
  toChannelMessageResponse,
  toChatMessagesResponse,
} from "~/modules/chat/contracts/ChatContractMapper";
import { Chat } from "~/modules/chat/entities/Chat";
import type { AiModelConfigurationDTO } from "~/modules/chat/entities/dtos/AiChatGatewayDTO";
import {
  SendWebMessageRequestDTO,
  WebChatResponseEventDTO,
} from "~/modules/chat/entities/dtos/ChatDTO";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { Printable } from "~/shared/http/utils/Printable";

function createModelConfiguration(
  supportedReasoningEfforts: ReasoningEffort[],
): AiModelConfigurationDTO {
  const currentModel = {
    provider: "openai-codex",
    model: "gpt-5.6-sol",
  };
  return {
    currentModel,
    availableModels: [
      currentModel,
      { provider: "zai-coding-cn", model: "glm-5.2" },
    ],
    supportedReasoningEfforts,
  };
}

describe("Chat contracts", () => {
  test("serialized API messages are mapped to the client contract", () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.Web, "user@example.com");
    const message = chat.addUserTextMessage(
      "hello",
      "legacy-provider-message-id",
    );
    message.sequence = 1;
    const response = toChannelMessageResponse(message);
    const wireResponse = JSON.parse(Printable.make(response));

    expect(wireResponse).toMatchObject({
      client_message_id: message.channelMessageId,
      user_type: "user",
    });
    expect(parseChatMessage(wireResponse)).toMatchObject({
      id: message.id,
      clientMessageId: message.channelMessageId,
      text: "hello",
      userType: "user",
    });
  });

  test("web message requests still require UUID client correlation", () => {
    const result = SendWebMessageRequestDTO.safeParse({
      text: "hello",
      clientMessageId: "legacy-provider-message-id",
    });

    expect(result.success).toBe(false);
  });

  test("web progress events parse reasoning and tool lifecycle payloads", () => {
    expect(
      WebChatResponseEventDTO.parse({
        type: "reasoningDelta",
        round: 1,
        contentIndex: 0,
        delta: "Inspecting",
      }),
    ).toMatchObject({ type: "reasoningDelta", delta: "Inspecting" });
    expect(
      WebChatResponseEventDTO.parse({
        type: "toolResult",
        round: 1,
        callId: "call-1",
        name: "list_todos",
        outcome: { status: "succeeded", data: { count: 0 } },
      }),
    ).toMatchObject({
      type: "toolResult",
      outcome: { status: "succeeded", data: { count: 0 } },
    });
  });

  test("persisted messages round trip through the authoritative snapshot", () => {
    const chat = new Chat();
    const message = chat.addAssistantTextMessage("done");
    message.sequence = 7;
    const response = toChatMessagesResponse(
      chat,
      createModelConfiguration([ReasoningEffort.Off, ReasoningEffort.High]),
    );
    const wireResponse = JSON.parse(Printable.make(response));

    const messages = parseChatMessages(wireResponse);

    expect(wireResponse).toMatchObject({
      current_model: {
        provider: "openai-codex",
        model: "gpt-5.6-sol",
      },
      available_models: [
        { provider: "openai-codex", model: "gpt-5.6-sol" },
        { provider: "zai-coding-cn", model: "glm-5.2" },
      ],
      messages: [{ id: message.id, user_type: "bot" }],
    });
    expect(messages).toEqual([
      expect.objectContaining({ id: message.id, text: "done" }),
    ]);
  });

  test("web snapshots attach ordered generation traces to the final answer", () => {
    const chat = new Chat();
    chat.setReasoningEffort(ReasoningEffort.High);
    const userMessage = chat.addUserTextMessage("Think");
    const generation = chat.addGeneration({
      turnId: userMessage.turnId,
      provider: "zai",
      model: "glm-5.2",
      api: "openai-completions",
      reasoningEffort: ReasoningEffort.High,
      finishReason: "stop",
      usage: {
        input: 10,
        output: 20,
        cacheRead: 0,
        cacheWrite: 0,
        reasoning: 12,
        totalTokens: 30,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
    });
    const reasoning = chat.addAssistantReasoningMessage(
      userMessage.turnId,
      generation.id,
      "Inspect the state",
    );
    const intermediate = chat.addAssistantTextMessage("intermediate", {
      turnId: userMessage.turnId,
      generationId: generation.id,
      audience: MessageAudience.Model,
    });
    const answer = chat.addAssistantTextMessage("done", {
      turnId: userMessage.turnId,
      generationId: generation.id,
    });
    userMessage.sequence = 1;
    reasoning.sequence = 2;
    intermediate.sequence = 3;
    answer.sequence = 4;
    generation.sequence = 1;

    const response = toChatMessagesResponse(
      chat,
      createModelConfiguration([ReasoningEffort.Off, ReasoningEffort.High]),
    );
    const parsed = parseChatMessages(JSON.parse(Printable.make(response)));

    expect(parsed.at(-1)?.trace).toEqual([
      expect.objectContaining({
        provider: "zai",
        model: "glm-5.2",
        reasoningEffort: ReasoningEffort.High,
        usage: expect.objectContaining({ reasoning: 12, totalTokens: 30 }),
        items: [
          { type: "reasoning", text: "Inspect the state" },
          { type: "text", text: "intermediate" },
        ],
      }),
    ]);
  });

  test("web snapshots keep traces when a fallback answer has no generation", () => {
    const chat = new Chat();
    const userMessage = chat.addUserTextMessage("Run the tool");
    const generation = chat.addGeneration({
      turnId: userMessage.turnId,
      provider: "zai",
      model: "glm-5.2",
      api: "openai-completions",
      reasoningEffort: ReasoningEffort.High,
      finishReason: "toolUse",
    });
    const reasoning = chat.addAssistantReasoningMessage(
      userMessage.turnId,
      generation.id,
      "Inspect the account",
    );
    const toolCall = chat.addAssistantToolCall(
      userMessage.turnId,
      generation.id,
      {
        type: MessageContentType.ToolCall,
        callId: "call-1",
        name: "get_bank_accounts",
        arguments: {},
      },
    );
    const toolResult = chat.addToolResult(userMessage.turnId, {
      type: MessageContentType.ToolResult,
      callId: "call-1",
      outcome: {
        status: ToolResultStatus.Failed,
        code: "ProviderError",
        message: "Bank unavailable",
      },
    });
    const fallback = chat.addAssistantTextMessage("Please try again.", {
      turnId: userMessage.turnId,
      audience: MessageAudience.Both,
    });
    userMessage.sequence = 1;
    reasoning.sequence = 2;
    toolCall.sequence = 3;
    toolResult.sequence = 4;
    fallback.sequence = 5;
    generation.sequence = 1;

    const response = toChatMessagesResponse(
      chat,
      createModelConfiguration([ReasoningEffort.High]),
    );
    const parsed = parseChatMessages(JSON.parse(Printable.make(response)));

    expect(parsed.at(-1)).toMatchObject({
      id: fallback.id,
      trace: [
        {
          id: generation.id,
          items: [
            { type: "reasoning", text: "Inspect the account" },
            {
              type: "toolCall",
              callId: "call-1",
              name: "get_bank_accounts",
            },
            {
              type: "toolResult",
              callId: "call-1",
              outcome: { status: ToolResultStatus.Failed },
            },
          ],
        },
      ],
    });
  });
});
