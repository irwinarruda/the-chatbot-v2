import type { Model } from "@earendil-works/pi-ai";
import { MessageContentType } from "~/modules/chat/domain/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/domain/enums/MessageRole";
import { ToolResultStatus } from "~/modules/chat/domain/enums/ToolResultStatus";
import { PiMessageMapper } from "~/modules/chat/server/PiMessageMapper";
import { ValidationException } from "~/shared/errors/DomainErrors";

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

describe("PiMessageMapper", () => {
  test("maps text, buttons, and audio transcripts in order", () => {
    const messages = PiMessageMapper.map(
      [
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
      ],
      model,
    );

    expect(messages[0]).toMatchObject({ role: "user", content: "hello" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "[Button][A;B]choose" }],
    });
    expect(messages[2]).toMatchObject({
      role: "user",
      content: "audio text",
    });
  });

  test("groups assistant tool calls and resolves result tool names", () => {
    const messages = PiMessageMapper.map(
      [
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
      ],
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

  test("rejects results without an earlier canonical tool call", () => {
    expect(() =>
      PiMessageMapper.map(
        [
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
        ],
        model,
      ),
    ).toThrow(ValidationException);
  });
});
