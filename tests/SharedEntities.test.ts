import { AddTransactionToolDTO } from "~/modules/cash-flow/application/tools/AddTransactionToolDTO";
import { TransferBetweenBankAccountsToolDTO } from "~/modules/cash-flow/application/tools/TransferBetweenBankAccountsToolDTO";
import { CashFlowSpreadsheet } from "~/modules/cash-flow/domain/CashFlowSpreadsheet";
import { CashFlowSpreadsheetType } from "~/modules/cash-flow/domain/enums/CashFlowSpreadsheetType";
import { Chat } from "~/modules/chat/domain/Chat";
import { ConversationSummary } from "~/modules/chat/domain/ConversationSummary";
import { ChatChannel } from "~/modules/chat/domain/enums/ChatChannel";
import { MessageAudience } from "~/modules/chat/domain/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/domain/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/domain/enums/MessageRole";
import { ToolResultStatus } from "~/modules/chat/domain/enums/ToolResultStatus";
import { Message } from "~/modules/chat/domain/Message";
import { BsuidUtils } from "~/modules/identity/domain/BsuidUtils";
import { Credential } from "~/modules/identity/domain/Credentials";
import { CredentialType } from "~/modules/identity/domain/enums/CredentialType";
import { PhoneNumberUtils } from "~/modules/identity/domain/PhoneNumberUtils";
import { User } from "~/modules/identity/domain/User";
import { CreateTodosToolDTO } from "~/modules/todos/application/tools/CreateTodosToolDTO";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("shared entities", () => {
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

    const toolCall = chat.addAssistantToolCall(audioMessage.turnId, {
      type: MessageContentType.ToolCall,
      callId: "call-1",
      name: "list_todos",
      arguments: { status: "Pending" },
    });
    expect(toolCall.audience).toBe(MessageAudience.Model);
    expect(() =>
      chat.addAssistantToolCall("unknown-turn", {
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

  test("User validates inputs, manages google credentials, and serializes", () => {
    expect(() => new User("x".repeat(30), "5511984444444")).toThrow(
      ValidationException,
    );
    expect(() => new User("Irwin", "123")).toThrow(ValidationException);

    const user: User = new User(
      "Irwin",
      "(55) 11 98444-4444",
      "user@example.com",
    );
    expect(user.phoneNumber).toBe("5511984444444");
    user.bsuid = "BR.13491208655302741918";
    expect(user.toJSON().bsuid).toBe("BR.13491208655302741918");

    const emailOnlyUser = new User("Irwin", undefined, "only@example.com");
    expect(emailOnlyUser.phoneNumber).toBeUndefined();
    expect(emailOnlyUser.email).toBe("only@example.com");

    user.updateEmail("updated@example.com");
    expect(user.email).toBe("updated@example.com");

    user.createGoogleCredential("access", "refresh", 3600);
    expect(user.googleCredential?.type).toBe(CredentialType.Google);
    expect(user.googleCredential?.expiresInSeconds).toBe(3600);

    const nonGoogleCredential = new Credential();
    nonGoogleCredential.type = "Other" as CredentialType;
    expect(() => user.addGoogleCredential(nonGoogleCredential)).toThrow(
      ValidationException,
    );

    const replacementCredential = new Credential();
    replacementCredential.type = CredentialType.Google;
    user.addGoogleCredential(replacementCredential);
    expect(user.googleCredential).toBe(replacementCredential);

    user.updateGoogleCredential("next-access", "next-refresh");
    expect(user.googleCredential?.accessToken).toBe("next-access");
    expect(user.googleCredential?.refreshToken).toBe("next-refresh");
    expect(user.googleCredential?.expirationDate).toBeUndefined();

    const userWithoutCredential = new User("Irwin", "5511984444444");
    expect(() =>
      userWithoutCredential.updateGoogleCredential("access", "refresh"),
    ).toThrow(ValidationException);

    expect(user.toJSON()).toMatchObject({
      name: "Irwin",
      email: "updated@example.com",
      phoneNumber: "5511984444444",
      bsuid: "BR.13491208655302741918",
    });
  });

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

  test("tool DTOs reject invalid mutating arguments", () => {
    expect(() =>
      AddTransactionToolDTO.parse({
        type: "Expense",
        user_message: "invalid value",
        value: 0,
      }),
    ).toThrow();
    expect(() =>
      TransferBetweenBankAccountsToolDTO.parse({
        user_message: "invalid date",
        value: 10,
        date: "2026-02-30",
      }),
    ).toThrow();
    expect(() => CreateTodosToolDTO.parse({ todos: [] })).toThrow();
  });

  test("Credential constructor and update handle expiration with and without ttl", () => {
    const credential = new Credential(120);
    expect(credential.expirationDate).toBeInstanceOf(Date);

    credential.update("access", "refresh", 60);
    expect(credential.accessToken).toBe("access");
    expect(credential.refreshToken).toBe("refresh");
    expect(credential.expiresInSeconds).toBe(60);
    expect(credential.expirationDate).toBeInstanceOf(Date);

    credential.update("access-2", "refresh-2");
    expect(credential.expiresInSeconds).toBeUndefined();
    expect(credential.expirationDate).toBeUndefined();

    expect(credential.toJSON()).toMatchObject({
      id: credential.id,
      idUser: "",
      type: "google",
    });
  });

  test("CashFlowSpreadsheet, PhoneNumberUtils, and BsuidUtils cover their branches", () => {
    expect(BsuidUtils.containsLetter("BR.13491208655302741918")).toBe(true);
    expect(BsuidUtils.containsLetter("user.98765432109876543210")).toBe(true);
    expect(BsuidUtils.containsLetter("5511984444444")).toBe(false);
    const brazilianWithoutNine = "551184444444";
    expect(PhoneNumberUtils.addDigitNine(brazilianWithoutNine)).toBe(
      "5511984444444",
    );
    expect(PhoneNumberUtils.addDigitNine("5511984444444")).toBe(
      "5511984444444",
    );
    expect(PhoneNumberUtils.addDigitNine("+1 (555) 123-4567")).toBe(
      "15551234567",
    );
    expect(PhoneNumberUtils.addDigitNine("123")).toBe("123");
    expect(PhoneNumberUtils.sanitize("+55 (11) 98444-4444")).toBe(
      "5511984444444",
    );
    expect(PhoneNumberUtils.isValid("1234567")).toBe(false);
    expect(PhoneNumberUtils.isValid("12345678")).toBe(true);
    expect(PhoneNumberUtils.isValid("1".repeat(16))).toBe(false);

    const spreadsheet = new CashFlowSpreadsheet();
    spreadsheet.idUser = "user-1";
    spreadsheet.idSheet = "sheet-1";
    spreadsheet.type = CashFlowSpreadsheetType.Google;
    expect(spreadsheet.toJSON()).toMatchObject({
      idUser: "user-1",
      idSheet: "sheet-1",
      type: "google",
    });
  });
});
