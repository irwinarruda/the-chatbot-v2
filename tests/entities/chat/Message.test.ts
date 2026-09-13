import { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { Message } from "~/modules/chat/entities/Message";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("Message", () => {
  test("Message validates content, role, and audience combinations", () => {
    const message = new Message({
      idChat: "chat-1",
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: {
        type: MessageContentType.Audio,
        mediaId: "media-1",
        mimeType: "audio/webm",
      },
    });
    message.addAudioTranscriptAndUrl("transcript", "https://example.com/audio");
    expect(message.toJSON()).toMatchObject({
      type: "audio",
      userType: "user",
      mediaUrl: "https://example.com/audio",
      mimeType: "audio/webm",
      transcript: "transcript",
    });

    const textMessage = new Message({
      idChat: "chat-1",
      role: MessageRole.Assistant,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Text, text: "hello" },
    });
    expect(() =>
      textMessage.addAudioTranscriptAndUrl("t", "https://example.com"),
    ).toThrow(ValidationException);
    expect(textMessage.toJSON()).toMatchObject({
      type: "text",
      userType: "bot",
      text: "hello",
    });

    const userButton = new Message({
      idChat: "chat-1",
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Button, text: "Yes" },
    });
    expect(userButton.toJSON()).toMatchObject({
      type: "interactive",
      userType: "user",
      buttonReply: "Yes",
    });

    const toolCallContent = {
      type: MessageContentType.ToolCall,
      callId: "call-1",
      name: "list_todos",
      arguments: {},
    } as const;
    const toolResultContent = {
      type: MessageContentType.ToolResult,
      callId: "call-1",
      outcome: { status: ToolResultStatus.Succeeded, data: {} },
    } as const;
    expect(
      () =>
        new Message({
          idChat: "chat-1",
          role: MessageRole.User,
          audience: MessageAudience.Model,
          content: toolCallContent,
        }),
    ).toThrow(ValidationException);
    expect(
      () =>
        new Message({
          idChat: "chat-1",
          role: MessageRole.Assistant,
          audience: MessageAudience.Both,
          content: toolCallContent,
        }),
    ).toThrow(ValidationException);
    expect(
      () =>
        new Message({
          idChat: "chat-1",
          role: MessageRole.Assistant,
          audience: MessageAudience.Model,
          content: toolResultContent,
        }),
    ).toThrow(ValidationException);
    expect(
      () =>
        new Message({
          idChat: "chat-1",
          role: MessageRole.Tool,
          audience: MessageAudience.Model,
          content: { type: MessageContentType.Text, text: "not a result" },
        }),
    ).toThrow(ValidationException);
    expect(
      () =>
        new Message({
          idChat: "chat-1",
          role: MessageRole.Tool,
          audience: MessageAudience.Model,
          content: {
            type: MessageContentType.ToolResult,
            callId: "call-1",
            outcome: {
              status: ToolResultStatus.Succeeded,
              data: {},
              code: "X",
              message: "boom",
            } as never,
          },
        }),
    ).toThrow(ValidationException);
    expect(
      () =>
        new Message({
          idChat: "chat-1",
          role: MessageRole.User,
          audience: MessageAudience.Both,
          content: { type: MessageContentType.Audio, mimeType: "" },
        }),
    ).toThrow(ValidationException);

    const toolMessage = new Message({
      idChat: "chat-1",
      generationId: "generation-1",
      role: MessageRole.Tool,
      audience: MessageAudience.Model,
      content: {
        type: MessageContentType.ToolResult,
        callId: "call-1",
        outcome: {
          status: ToolResultStatus.Failed,
          code: "Oops",
          message: "boom",
        },
      },
    });
    expect(() => toolMessage.toJSON()).toThrow(ValidationException);

    const restored = Message.restore({
      id: "message-1",
      idChat: "chat-1",
      turnId: "turn-1",
      sequence: 3,
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Text, text: "restored" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(restored.id).toBe("message-1");
    expect(restored.sequence).toBe(3);
    expect(restored.text).toBe("restored");
    expect(() =>
      Message.restore({
        id: "message-2",
        idChat: "chat-1",
        turnId: "turn-1",
        sequence: 4,
        role: "Invalid",
        audience: MessageAudience.Both,
        content: { type: MessageContentType.Text, text: "invalid" },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(ValidationException);
  });
});
