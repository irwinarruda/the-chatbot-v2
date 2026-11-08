import type { AssistantMessage } from "@earendil-works/pi-ai";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ValidationException } from "~/domain/shared/domain-errors";
import { mapPiAssistantResponse } from "~/server/modules/chat/gateways/pi.assistant-response";

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
      items: [
        {
          type: MessageContentType.Button,
          text: "Which account did you use?",
          options: ["Nubank", "Itau", "Cash"],
        },
      ],
    });
  });

  test("preserves reasoning before a terminal options reply", () => {
    const response = createAssistantMessage([
      {
        type: "thinking",
        thinking: "The user needs to select one account",
        thinkingSignature: "thinking-signature",
        redacted: false,
      },
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
      items: [
        {
          type: MessageContentType.Reasoning,
          text: "The user needs to select one account",
          thinkingSignature: "thinking-signature",
          redacted: false,
        },
        {
          type: MessageContentType.Button,
          text: "Which account did you use?",
          options: ["Nubank", "Itau", "Cash"],
        },
      ],
    });
  });

  test("maps normal text without parsing presentation markers", () => {
    const response = createAssistantMessage([
      { type: "text", text: "[Button][A;B]Choose one" },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      items: [
        {
          type: MessageContentType.Text,
          text: "[Button][A;B]Choose one",
          textSignature: undefined,
        },
      ],
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
      items: [
        {
          type: MessageContentType.ToolCall,
          callId: "call-1",
          name: "list_todos",
          arguments: { status: "Pending" },
          thoughtSignature: undefined,
        },
      ],
    });
  });

  test("preserves ordered reasoning, text, and provider signatures", () => {
    const response = createAssistantMessage([
      {
        type: "thinking",
        thinking: "Inspect the durable state",
        thinkingSignature: "thinking-signature",
        redacted: false,
      },
      {
        type: "text",
        text: "Done",
        textSignature: "text-signature",
      },
      {
        type: "toolCall",
        id: "call-1",
        name: "list_todos",
        arguments: {},
        thoughtSignature: "thought-signature",
      },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      items: [
        {
          type: MessageContentType.Reasoning,
          text: "Inspect the durable state",
          thinkingSignature: "thinking-signature",
          redacted: false,
        },
        {
          type: MessageContentType.Text,
          text: "Done",
          textSignature: "text-signature",
        },
        {
          type: MessageContentType.ToolCall,
          callId: "call-1",
          name: "list_todos",
          arguments: {},
          thoughtSignature: "thought-signature",
        },
      ],
    });
  });

  test("sends text written beside an options reply as its own message before the question", () => {
    const response = createAssistantMessage([
      {
        type: "toolCall",
        id: "reply-1",
        name: "reply_with_options",
        arguments: {
          message: "Quer marcar a Academia como paga?",
          options: ["Sim", "Não"],
        },
      },
      {
        type: "text",
        text: "Academia registrada ✅\n\nSaldo NuConta: R$ 2.400,00\n",
        textSignature: "text-signature",
      },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      items: [
        {
          type: MessageContentType.Text,
          text: "Academia registrada ✅\n\nSaldo NuConta: R$ 2.400,00",
          textSignature: "text-signature",
        },
        {
          type: MessageContentType.Button,
          text: "Quer marcar a Academia como paga?",
          options: ["Sim", "Não"],
        },
      ],
    });
  });

  test("drops text lines the options message already carries", () => {
    const response = createAssistantMessage([
      {
        type: "text",
        text: "Academia registrada ✅\n\nSaldo NuConta: R$ 2.400,00",
        textSignature: "text-signature",
      },
      {
        type: "toolCall",
        id: "reply-1",
        name: "reply_with_options",
        arguments: {
          message:
            "Saldo NuConta: R$ 2.400,00\n\nQuer marcar a Academia como paga?",
          options: ["Sim", "Não"],
        },
      },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      items: [
        {
          type: MessageContentType.Text,
          text: "Academia registrada ✅",
          textSignature: undefined,
        },
        {
          type: MessageContentType.Button,
          text: "Saldo NuConta: R$ 2.400,00\n\nQuer marcar a Academia como paga?",
          options: ["Sim", "Não"],
        },
      ],
    });
  });

  test("sends no extra message when the text only repeats the options message", () => {
    const response = createAssistantMessage([
      { type: "text", text: "Choose one" },
      {
        type: "toolCall",
        id: "reply-1",
        name: "reply_with_options",
        arguments: { message: "Choose one", options: ["A", "B"] },
      },
    ]);

    expect(mapPiAssistantResponse(response)).toEqual({
      items: [
        {
          type: MessageContentType.Button,
          text: "Choose one",
          options: ["A", "B"],
        },
      ],
    });
  });

  test("rejects options replies mixed with business tools", () => {
    const response = createAssistantMessage([
      {
        type: "toolCall",
        id: "record-1",
        name: "add_transaction",
        arguments: { type: "Expense", value: 10, user_message: "10" },
      },
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
