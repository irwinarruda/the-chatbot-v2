import type { AssistantMessage } from "@earendil-works/pi-ai";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { mapPiAssistantResponse } from "~/modules/chat/gateway/AiChatGateway/mapPiAssistantResponse";
import { ValidationException } from "~/shared/errors/DomainErrors";

function createAssistantMessage(
  content: AssistantMessage["content"],
): AssistantMessage {
  return {
    role: "assistant",
    content,
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
    stopReason: "toolUse",
    timestamp: 0,
  };
}

describe("mapPiAssistantResponse", () => {
  test("maps reply_with_options into terminal button content", () => {
    const response = createAssistantMessage([
      {
        type: "toolCall",
        id: "reply-1",
        name: "reply_with_options",
        arguments: {
          message: "Which account did you use?",
          options: ["Nubank", "Itau", "Cash"],
        },
      },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      content: {
        type: MessageContentType.Button,
        text: "Which account did you use?",
        options: ["Nubank", "Itau", "Cash"],
      },
      toolCalls: [],
    });
  });

  test("maps normal text without parsing presentation markers", () => {
    const response = createAssistantMessage([
      { type: "text", text: "[Button][A;B]Choose one" },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      content: {
        type: MessageContentType.Text,
        text: "[Button][A;B]Choose one",
      },
      toolCalls: [],
    });
  });

  test("keeps business tool calls in the execution path", () => {
    const response = createAssistantMessage([
      {
        type: "toolCall",
        id: "call-1",
        name: "list_todos",
        arguments: { status: "Pending" },
      },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      content: undefined,
      toolCalls: [
        {
          type: MessageContentType.ToolCall,
          callId: "call-1",
          name: "list_todos",
          arguments: { status: "Pending" },
        },
      ],
    });
  });

  test("rejects options replies mixed with text or business tools", () => {
    const response = createAssistantMessage([
      { type: "text", text: "Choose one" },
      {
        type: "toolCall",
        id: "reply-1",
        name: "reply_with_options",
        arguments: { message: "Choose one", options: ["A", "B"] },
      },
    ]);

    expect(() => mapPiAssistantResponse(response)).toThrow(ValidationException);
  });

  test("rejects invalid options reply arguments", () => {
    const response = createAssistantMessage([
      {
        type: "toolCall",
        id: "reply-1",
        name: "reply_with_options",
        arguments: { message: "Choose one", options: [] },
      },
    ]);

    expect(() => mapPiAssistantResponse(response)).toThrow(ValidationException);
  });
});
