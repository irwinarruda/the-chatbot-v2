import type {
  AssistantMessage,
  AssistantMessageEvent,
} from "@earendil-works/pi-ai";
import { describe, expect, test } from "vitest";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { mapPiAssistantProgress } from "~/modules/chat/gateway/AiChatGateway/mapPiAssistantProgress";

function createAssistantMessage(): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: "openai-completions",
    provider: "test",
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: "stop",
    timestamp: 0,
  };
}

describe("mapPiAssistantProgress", () => {
  test("maps reasoning deltas while the provider is still responding", () => {
    const event: AssistantMessageEvent = {
      type: "thinking_delta",
      contentIndex: 0,
      delta: "Inspecting the chat",
      partial: createAssistantMessage(),
    };

    expect(mapPiAssistantProgress(event)).toEqual({
      type: "reasoningDelta",
      contentIndex: 0,
      delta: "Inspecting the chat",
    });
  });

  test("maps completed business tool calls and hides the reply tool", () => {
    const partial = createAssistantMessage();
    const toolEvent: AssistantMessageEvent = {
      type: "toolcall_end",
      contentIndex: 1,
      toolCall: {
        type: "toolCall",
        id: "call-1",
        name: "list_todos",
        arguments: { status: "Pending" },
      },
      partial,
    };
    const replyEvent: AssistantMessageEvent = {
      type: "toolcall_end",
      contentIndex: 2,
      toolCall: {
        type: "toolCall",
        id: "reply-1",
        name: "reply_with_options",
        arguments: { message: "Choose", options: ["A", "B"] },
      },
      partial,
    };

    expect(mapPiAssistantProgress(toolEvent)).toEqual({
      type: "toolCall",
      contentIndex: 1,
      call: {
        type: MessageContentType.ToolCall,
        callId: "call-1",
        name: "list_todos",
        arguments: { status: "Pending" },
        thoughtSignature: undefined,
      },
    });
    expect(mapPiAssistantProgress(replyEvent)).toBeUndefined();
  });
});
