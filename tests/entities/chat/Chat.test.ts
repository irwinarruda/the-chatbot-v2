import { Chat } from "~/modules/chat/entities/Chat";
import { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("Chat", () => {
  test("Chat handles channel addresses, audiences, tool invariants, and serialization", () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, "5511984444444");
    expect(chat.whatsAppAddress).toBe("5511984444444");
    expect(chat.webAddress).toBeUndefined();
    chat.setChannelAddress(ChatChannel.Web, "User@Example.com");
    expect(chat.webAddress).toBe("user@example.com");
    expect(() => chat.setChannelAddress(ChatChannel.WhatsApp, "")).toThrow(
      ValidationException,
    );
    expect(chat.getChannelAddress()).toBe("user@example.com");

    const userMessage = chat.addUserTextMessage("hello", "provider-1");
    expect(userMessage.turnId).toBe(userMessage.id);
    expect(userMessage.role).toBe(MessageRole.User);
    const assistantMessage = chat.addAssistantTextMessage("hi", {
      turnId: userMessage.turnId,
    });
    expect(assistantMessage.turnId).toBe(userMessage.turnId);
    expect(assistantMessage.role).toBe(MessageRole.Assistant);
    const buttonMessage = chat.addUserButtonMessage("yes", "provider-3");
    chat.addAssistantButtonMessage("choose", ["A", "B"], {
      turnId: buttonMessage.turnId,
    });
    const audioMessage = chat.addUserAudioMessage(
      "media-1",
      "audio/webm",
      "provider-5",
    );
    const notice = chat.addAssistantTextMessage("processing...", {
      turnId: audioMessage.turnId,
      audience: MessageAudience.Channel,
    });

    const generation = chat.addGeneration({
      turnId: audioMessage.turnId,
      provider: "test",
      model: "test-model",
      api: "test-api",
      reasoningEffort: ReasoningEffort.High,
      finishReason: "toolUse",
    });
    const toolCall = chat.addAssistantToolCall(
      audioMessage.turnId,
      generation.id,
      {
        type: MessageContentType.ToolCall,
        callId: "call-1",
        name: "list_todos",
        arguments: { status: "Pending" },
      },
    );
    expect(toolCall.audience).toBe(MessageAudience.Model);
    expect(() =>
      chat.addAssistantToolCall("unknown-turn", generation.id, {
        type: MessageContentType.ToolCall,
        callId: "call-x",
        name: "list_todos",
        arguments: {},
      }),
    ).toThrow(ValidationException);
    expect(() =>
      chat.addToolResult(audioMessage.turnId, {
        type: MessageContentType.ToolResult,
        callId: "missing-call",
        outcome: { status: ToolResultStatus.Succeeded, data: {} },
      }),
    ).toThrow(ValidationException);
    expect(() =>
      chat.addToolResult(userMessage.turnId, {
        type: MessageContentType.ToolResult,
        callId: "call-1",
        outcome: { status: ToolResultStatus.Succeeded, data: {} },
      }),
    ).toThrow(ValidationException);
    const toolResult = chat.addToolResult(audioMessage.turnId, {
      type: MessageContentType.ToolResult,
      callId: "call-1",
      outcome: { status: ToolResultStatus.Succeeded, data: { count: 0 } },
    });
    expect(() =>
      chat.addToolResult(audioMessage.turnId, {
        type: MessageContentType.ToolResult,
        callId: "call-1",
        outcome: { status: ToolResultStatus.Succeeded, data: {} },
      }),
    ).toThrow(ValidationException);
    expect(chat.getToolResult(audioMessage.turnId, "call-1")?.id).toBe(
      toolResult.id,
    );

    const channelMessages = chat.getChannelMessages();
    expect(channelMessages).toContain(notice);
    expect(channelMessages).not.toContain(toolCall);
    expect(channelMessages).not.toContain(toolResult);
    const modelMessages = chat.getModelMessages();
    expect(modelMessages).toContain(toolCall);
    expect(modelMessages).toContain(toolResult);
    expect(modelMessages).not.toContain(notice);

    const serialized = chat.toJSON();
    expect(serialized.channel).toBe("web");
    expect(serialized.whatsAppAddress).toBe("5511984444444");
    expect(serialized.webAddress).toBe("user@example.com");
    expect(serialized.messages).toHaveLength(6);

    chat.addUser("user-1");
    expect(() => chat.addUser("user-2")).toThrow(ValidationException);
    chat.deleteChat();
    expect(chat.isDeleted).toBe(true);
    expect(() => chat.deleteChat()).toThrow(ValidationException);
  });

  test("Chat summary cursor advances only through complete turns", () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, "5511984444444");
    const firstUser = chat.addUserTextMessage("first");
    chat.addAssistantTextMessage("first reply", { turnId: firstUser.turnId });
    const secondUser = chat.addUserTextMessage("second");
    const secondReply = chat.addAssistantTextMessage("second reply", {
      turnId: secondUser.turnId,
    });
    const thirdUser = chat.addUserTextMessage("third");
    chat.messages.forEach((message, index) => {
      message.sequence = index + 1;
    });
    const summary = (compactedThroughSequence: number) =>
      new ConversationSummary({
        userProfile: ["profile"],
        durableFacts: [],
        compactedThroughSequence,
      });
    expect(() => chat.setSummary(summary(99))).toThrow(ValidationException);
    expect(() => chat.setSummary(summary(1))).toThrow(ValidationException);
    expect(() => chat.setSummary(summary(5))).toThrow(ValidationException);
    chat.setSummary(summary(2));
    expect(chat.summary?.compactedThroughSequence).toBe(2);
    expect(chat.getModelMessages().map((m) => m.id)).toEqual([
      secondUser.id,
      secondReply.id,
      thirdUser.id,
    ]);
    expect(chat.getUncompactedTurns()).toHaveLength(2);
    expect(() => chat.setSummary(summary(2))).toThrow(ValidationException);
    chat.setSummary(summary(4));
    expect(chat.getModelMessages().map((m) => m.id)).toEqual([thirdUser.id]);
  });

  test("Chat keeps reasoning available only to its active model turn", () => {
    const chat = new Chat();
    const command = chat.addUserCommandMessage(
      "/effort high",
      "effort",
      { level: "high" },
      "command-1",
    );
    chat.setReasoningEffort(ReasoningEffort.High);
    const userMessage = chat.addUserTextMessage("Think carefully");
    const generation = chat.addGeneration({
      turnId: userMessage.turnId,
      provider: "zai",
      model: "glm-5.2",
      api: "openai-completions",
      reasoningEffort: ReasoningEffort.High,
      finishReason: "stop",
    });
    const reasoning = chat.addAssistantReasoningMessage(
      userMessage.turnId,
      generation.id,
      "private provider artifact",
      { thinkingSignature: "signature" },
    );

    expect(chat.reasoningEffort).toBe(ReasoningEffort.High);
    expect(command.toJSON()).toMatchObject({
      type: "command",
      text: "/effort high",
    });
    expect(chat.getChannelMessages()).toContain(command);
    expect(chat.getChannelMessages()).not.toContain(reasoning);
    expect(chat.getModelMessages()).not.toContain(command);
    expect(chat.getModelMessages()).not.toContain(reasoning);
    expect(chat.getModelMessages(userMessage.turnId)).toContain(reasoning);
    expect(() => reasoning.toJSON()).toThrow(ValidationException);
  });
});
