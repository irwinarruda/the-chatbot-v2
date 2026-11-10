import type { Model } from "@earendil-works/pi-ai";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { MessageRole } from "~/domain/chat/message-role";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { AiChatContextMessageDTO } from "~/server/modules/chat/gateways/ai-chat";
import { PiMessageMapper } from "~/server/modules/chat/gateways/pi.message-mapper";

const model: Model<"openai-completions"> = {
  id: "test-model",
  name: "Test Model",
  api: "openai-completions",
  provider: "test",
  baseUrl: "https://example.com/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000,
  maxTokens: 100,
};

function contextMessages(
  messages: Array<Omit<AiChatContextMessageDTO, "timestamp">>,
): AiChatContextMessageDTO[] {
  return messages.map((message, index) => ({
    ...message,
    timestamp: index + 1,
  }));
}

describe("PiMessageMapper", () => {
  test("maps text, options replies, and audio transcripts in order", () => {
    const messages = PiMessageMapper.map(
      contextMessages([
        {
          role: MessageRole.User,
          content: { type: MessageContentType.Text, text: "hello" },
        },
        {
          role: MessageRole.Assistant,
          content: {
            type: MessageContentType.Button,
            text: "choose",
            options: ["A", "B"],
          },
        },
        {
          role: MessageRole.User,
          content: {
            type: MessageContentType.Audio,
            mimeType: "audio/ogg",
            transcript: "audio text",
          },
        },
      ]),
      model,
    );

    expect(messages[0]).toMatchObject({ role: "user", content: "hello" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      stopReason: "toolUse",
      content: [
        {
          type: "toolCall",
          id: "reply_1",
          name: "reply_with_options",
          arguments: { message: "choose", options: ["A", "B"] },
        },
      ],
    });
    expect(messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "reply_1",
      toolName: "reply_with_options",
      isError: false,
    });
    expect(messages[3]).toMatchObject({
      role: "user",
      content: "audio text",
    });
  });

  test("replays each options reply as its own tool call, after the text of the same generation", () => {
    const generation = {
      id: "generation-1",
      finishReason: "toolUse",
      timestamp: 1,
    };
    const messages = PiMessageMapper.map(
      contextMessages([
        {
          role: MessageRole.Assistant,
          generation,
          content: {
            type: MessageContentType.Text,
            text: "Academia registrada",
          },
        },
        {
          role: MessageRole.Assistant,
          generation,
          content: {
            type: MessageContentType.Button,
            text: "Marcar como paga?",
            options: ["Sim", "Não"],
          },
        },
        {
          role: MessageRole.User,
          content: { type: MessageContentType.Button, text: "Sim" },
        },
        {
          role: MessageRole.Assistant,
          content: {
            type: MessageContentType.Button,
            text: "Apagar a tarefa?",
            options: ["Confirmar", "Cancelar"],
          },
        },
      ]),
      model,
    );

    expect(messages.map((message) => message.role)).toEqual([
      "assistant",
      "toolResult",
      "user",
      "assistant",
      "toolResult",
    ]);
    expect(messages[0]).toMatchObject({
      content: [
        { type: "text", text: "Academia registrada" },
        {
          type: "toolCall",
          id: "reply_1",
          arguments: { message: "Marcar como paga?", options: ["Sim", "Não"] },
        },
      ],
    });
    expect(messages[2]).toMatchObject({ role: "user", content: "Sim" });
    expect(messages[3]).toMatchObject({
      content: [{ type: "toolCall", id: "reply_2" }],
    });
    expect(JSON.stringify(messages)).not.toContain("Selectable options");
  });

  test("groups assistant tool calls and resolves result tool names", () => {
    const messages = PiMessageMapper.map(
      contextMessages([
        {
          role: MessageRole.Assistant,
          content: {
            type: MessageContentType.ToolCall,
            callId: "call-a",
            name: "first_tool",
            arguments: { value: 1 },
          },
        },
        {
          role: MessageRole.Assistant,
          content: {
            type: MessageContentType.ToolCall,
            callId: "call-b",
            name: "second_tool",
            arguments: { value: 2 },
          },
        },
        {
          role: MessageRole.Tool,
          content: {
            type: MessageContentType.ToolResult,
            callId: "call-a",
            outcome: {
              status: ToolResultStatus.Succeeded,
              data: { done: true },
            },
          },
        },
        {
          role: MessageRole.Tool,
          content: {
            type: MessageContentType.ToolResult,
            callId: "call-b",
            outcome: {
              status: ToolResultStatus.Unknown,
              code: "UnconfirmedOutcome",
              message: "confirmation lost",
            },
          },
        },
      ]),
      model,
    );

    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({
      role: "assistant",
      content: [
        { type: "toolCall", id: "call-a", name: "first_tool" },
        { type: "toolCall", id: "call-b", name: "second_tool" },
      ],
    });
    expect(messages[1]).toMatchObject({
      role: "toolResult",
      toolCallId: "call-a",
      toolName: "first_tool",
      isError: false,
      details: { status: ToolResultStatus.Succeeded },
    });
    expect(messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "call-b",
      toolName: "second_tool",
      isError: true,
      details: { status: ToolResultStatus.Unknown },
    });
  });

  test("sends JSON-compatible tool arguments and result details", () => {
    const paidAt = new Date("2026-10-01T12:00:00.000Z");
    const messages = PiMessageMapper.map(
      contextMessages([
        {
          role: MessageRole.Assistant,
          content: {
            type: MessageContentType.ToolCall,
            callId: "call-json",
            name: "pay_bill",
            arguments: { name: "Energy", optional: undefined },
          },
        },
        {
          role: MessageRole.Tool,
          content: {
            type: MessageContentType.ToolResult,
            callId: "call-json",
            outcome: {
              status: ToolResultStatus.Succeeded,
              data: { paidAt, optional: undefined, amount: 100 },
            },
          },
        },
      ]),
      model,
    );

    expect(messages[0]).toMatchObject({
      content: [{ arguments: { name: "Energy" } }],
    });
    const outcome = {
      status: ToolResultStatus.Succeeded,
      data: { paidAt: "2026-10-01T12:00:00.000Z", amount: 100 },
    };
    expect(messages[1]).toMatchObject({
      content: [{ type: "text", text: JSON.stringify(outcome) }],
      details: outcome,
    });
  });

  test("replays generation metadata and signed content without loss", () => {
    const generation = {
      id: crypto.randomUUID(),
      provider: "zai",
      model: "glm-5.2",
      api: "openai-completions",
      responseId: "response-1",
      finishReason: "toolUse",
      usage: {
        input: 20,
        output: 10,
        cacheRead: 5,
        cacheWrite: 0,
        reasoning: 6,
        totalTokens: 30,
        cost: {
          input: 0.1,
          output: 0.2,
          cacheRead: 0.01,
          cacheWrite: 0,
          total: 0.31,
        },
      },
      timestamp: 100,
    };
    const messages = PiMessageMapper.map(
      contextMessages([
        {
          role: MessageRole.Assistant,
          generation,
          content: {
            type: MessageContentType.Reasoning,
            text: "reasoning",
            thinkingSignature: "thinking-signature",
          },
        },
        {
          role: MessageRole.Assistant,
          generation,
          content: {
            type: MessageContentType.Text,
            text: "working",
            textSignature: "text-signature",
          },
        },
        {
          role: MessageRole.Assistant,
          generation,
          content: {
            type: MessageContentType.ToolCall,
            callId: "call-signed",
            name: "list_todos",
            arguments: {},
            thoughtSignature: "thought-signature",
          },
        },
      ]),
      model,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "assistant",
      provider: "zai",
      model: "glm-5.2",
      responseId: "response-1",
      stopReason: "toolUse",
      usage: { reasoning: 6, totalTokens: 30 },
      content: [
        {
          type: "thinking",
          thinking: "reasoning",
          thinkingSignature: "thinking-signature",
        },
        {
          type: "text",
          text: "working",
          textSignature: "text-signature",
        },
        {
          type: "toolCall",
          id: "call-signed",
          thoughtSignature: "thought-signature",
        },
      ],
    });
  });

  test("rejects results without an earlier canonical tool call", () => {
    expect(() =>
      PiMessageMapper.map(
        contextMessages([
          {
            role: MessageRole.Tool,
            content: {
              type: MessageContentType.ToolResult,
              callId: "missing",
              outcome: {
                status: ToolResultStatus.Failed,
                code: "Missing",
                message: "missing call",
              },
            },
          },
        ]),
        model,
      ),
    ).toThrow(ValidationException);
  });
});
