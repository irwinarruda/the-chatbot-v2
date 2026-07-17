import { v4 as uuidv4 } from "uuid";
import { Chat } from "~/modules/chat/entities/Chat";
import { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { Message } from "~/modules/chat/entities/Message";
import { TestWhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway/TestWhatsAppMessagingGateway";
import type { AiToolService } from "~/modules/chat/services/AiToolService";
import { User } from "~/modules/identity/entities/User";
import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { createAppGoogleLoginState } from "./createAppGoogleLoginState";
import { orquestrator } from "./orquestrator";

function createReceiveMessage(message: string): string {
  return JSON.stringify(message);
}

function estimateCurrentRequest(chat: Chat, channelAddress: string): number {
  const tools = orquestrator.aiToolService.getDefinitions();
  const gateway = orquestrator.aiGateway;
  return gateway.estimateInputTokens({
    channelAddress,
    messages: chat.getModelMessages().map((message) => ({
      role: message.role,
      content: message.content,
    })),
    tools,
    memory: chat.summary,
  });
}

const delay = 10;

describe("MessagingService", () => {
  test("sendMessage", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    const user = await orquestrator.createUser({ phoneNumber });
    let chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeUndefined();
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("User 1"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.idUser).toBe(user.id);
    expect(chat?.messages.length).toBe(2);
    const userMessage = chat?.messages[0];
    expect(userMessage?.text).toBe("User 1");
    expect(userMessage?.role).toBe(MessageRole.User);
    const responseMessage = chat?.messages[1];
    expect(responseMessage?.text).toBe("Response to: User 1");
    expect(responseMessage?.role).toBe(MessageRole.Assistant);
    expect(responseMessage?.turnId).toBe(userMessage?.id);
    await orquestrator.messagingService.sendTextMessage(phoneNumber, "Bot 1");
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.messages.length).toBe(3);
  });

  test("receiveMessage", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    let chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeUndefined();
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("First message"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.idUser).toBeUndefined();
    expect(chat?.whatsAppAddress).toBe(phoneNumber);
    expect(chat?.messages.length).toBe(2);
    let userMessage = chat?.messages[0];
    expect(userMessage).toBeDefined();
    expect(userMessage?.text).toBe("First message");
    expect(userMessage?.role).toBe(MessageRole.User);
    let botMessage = chat?.messages[1];
    expect(botMessage).toBeDefined();
    expect(botMessage?.text).toContain("\ud83d\udc4b");
    expect(botMessage?.text).toMatch(/\/g\/[A-Za-z0-9_-]{22}/);
    expect(botMessage?.text).not.toContain(phoneNumber);

    const user = await orquestrator.createUser({ phoneNumber });
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("Second duplicate message"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("Second duplicate message"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    const channelMessageId = userMessage?.channelMessageId;
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.idUser).toBe(user.id);
    expect(chat?.whatsAppAddress).toBe(phoneNumber);
    expect(chat?.messages.length).toBe(4);
    userMessage = chat?.messages[2];
    expect(userMessage?.text).toBe("Second duplicate message");
    expect(userMessage?.channelMessageId).not.toBe(channelMessageId);
    botMessage = chat?.messages[3];
    expect(botMessage?.text).toBe("Response to: Second duplicate message");
  });

  test("anotherChatShouldBeCreatedWhenUserIsDeleted", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("Message 1"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    let chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.messages.length).toBe(2);
    await orquestrator.deleteUser(phoneNumber);
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeUndefined();
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("New message 2"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.messages[0]).toBeDefined();
    expect(chat?.messages[0]?.text).toBe("New message 2");
  });

  test("shouldNotReceiveMessageIfNumberIsNotAllowed", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("Message never reaches"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    let chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeUndefined();
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("Message never reaches"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
  });

  test("compaction does not trigger while the context fits the budget", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });
    for (let i = 0; i < 10; i++) {
      await orquestrator.messagingService.receiveWhatsAppMessage(
        createReceiveMessage(`Message ${i}`),
        "sig",
      );
      await new Promise((r) => setTimeout(r, delay));
    }
    await new Promise((r) => setTimeout(r, 100));
    const chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.messages.length).toBe(20);
    expect(chat?.summary).toBeUndefined();
    expect(chat?.getModelMessages().length).toBe(20);
  });

  test("compaction triggers before the request when the budget is exceeded", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });
    for (let i = 0; i < 10; i++) {
      await orquestrator.messagingService.receiveWhatsAppMessage(
        createReceiveMessage(`Message ${i}`),
        "sig",
      );
      await new Promise((r) => setTimeout(r, delay));
    }
    let chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    const config = orquestrator.aiConfig;
    const aiGateway = orquestrator.aiGateway;
    const originalContextWindowTokens = aiGateway.contextWindowTokens;
    aiGateway.contextWindowTokens =
      config.maxOutputTokens +
      config.safetyMarginTokens +
      estimateCurrentRequest(chat as Chat, phoneNumber) -
      50;
    try {
      await orquestrator.messagingService.receiveWhatsAppMessage(
        createReceiveMessage("Message over budget"),
        "sig",
      );
      await new Promise((r) => setTimeout(r, delay * 5));
      chat =
        await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
      expect(chat?.summary).toBeDefined();
      expect(chat?.summary?.userProfile.join(" ")).toContain("Summary of");
      expect(chat?.summary?.durableFacts).toEqual([]);
      expect(chat?.summary).toBeInstanceOf(ConversationSummary);
      expect(chat?.summary?.compactedThroughSequence).toBeGreaterThan(0);
      expect(chat?.messages.length).toBe(22);
      expect(chat?.getModelMessages().length).toBeLessThan(22);
      const lastMessage = chat?.messages[chat.messages.length - 1];
      expect(lastMessage?.text).toBe("Response to: Message over budget");
    } finally {
      aiGateway.contextWindowTokens = originalContextWindowTokens;
    }
  });

  test("a malformed summary stops the request without truncating history", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });
    for (let i = 0; i < 10; i++) {
      await orquestrator.messagingService.receiveWhatsAppMessage(
        createReceiveMessage(`Message ${i}`),
        "sig",
      );
      await new Promise((r) => setTimeout(r, delay));
    }
    let chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    const aiGateway = orquestrator.aiGateway;
    const config = orquestrator.aiConfig;
    const originalContextWindowTokens = aiGateway.contextWindowTokens;
    aiGateway.contextWindowTokens =
      config.maxOutputTokens +
      config.safetyMarginTokens +
      estimateCurrentRequest(chat as Chat, phoneNumber) -
      50;
    aiGateway.summaryError = new ValidationException("malformed summary");
    const requestCount = aiGateway.requests.length;
    try {
      await orquestrator.messagingService.receiveWhatsAppMessage(
        createReceiveMessage("Message over budget"),
        "sig",
      );
      await new Promise((r) => setTimeout(r, delay * 5));
      chat =
        await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
      expect(aiGateway.summaryCalls).toBeGreaterThan(0);
      expect(chat?.summary).toBeUndefined();
      expect(aiGateway.requests).toHaveLength(requestCount);
      const lastMessage = chat?.messages[chat.messages.length - 1];
      expect(lastMessage?.text).toContain("malformed summary");
      expect(lastMessage?.audience).toBe(MessageAudience.Both);
    } finally {
      aiGateway.summaryError = undefined;
      aiGateway.contextWindowTokens = originalContextWindowTokens;
    }
  });

  test("receiveWebMessage returns the authoritative persisted Web chat", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    const incomingWebAddress = webAddress.toUpperCase();

    const chat = await orquestrator.messagingService.receiveWebMessage(
      incomingWebAddress,
      {
        text: "Hello from web",
      },
    );
    expect(chat).toBeDefined();
    expect(chat?.channel).toBe(ChatChannel.Web);
    expect(chat?.webAddress).toBe(webAddress);
    expect(chat?.idUser).toBe(user.id);
    expect(chat?.messages.length).toBe(2);
    expect(chat?.messages[0]?.text).toBe("Hello from web");
    expect(chat?.messages[0]?.role).toBe(MessageRole.User);
    expect(chat?.messages[1]?.role).toBe(MessageRole.Assistant);
    expect(chat?.messages[1]?.text).toBe("Response to: Hello from web");
  });

  test("receiveWebMessage with buttonReply routes through web gateway", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      buttonReply: "Yes",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat).toBeDefined();
    expect(chat?.channel).toBe(ChatChannel.Web);
    expect(chat?.messages[0]?.buttonReply).toBe("Yes");
    expect(chat?.messages[0]?.role).toBe(MessageRole.User);
  });

  test("receiveWebMessage accepts web addresses without an allowlist row", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "web message",
    });
    await new Promise((r) => setTimeout(r, delay));
    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat).toBeDefined();
    expect(chat?.messages[0]?.text).toBe("web message");
  });

  test("receiveWebMessage rejects invalid payloads through the gateway", async () => {
    await expect(
      orquestrator.messagingService.receiveWebMessage("5511912345678", {
        text: 123,
      }),
    ).rejects.toThrow(ValidationException);
  });

  test("handleGoogleRedirect syncs email onto an existing WhatsApp chat", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);

    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("WhatsApp history"),
      "sig",
    );
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      phoneNumber,
    );
    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");

    const user = await orquestrator.authService.getUserByEmail(
      "savegooglecredentials@example.com",
    );
    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      user?.email ?? "",
      ChatChannel.Web,
    );
    expect(chat?.idUser).toBe(user?.id);
    expect(chat?.webAddress).toBe(user?.email);
    expect(chat?.messages[0]?.text).toBe("WhatsApp history");
    await orquestrator.messagingService.receiveWebMessage(user?.email ?? "", {
      text: "Web follow-up",
    });
    await new Promise((r) => setTimeout(r, delay));
    const updatedChat =
      await orquestrator.messagingService.getChatByChannelAddress(
        user?.email ?? "",
        ChatChannel.Web,
      );
    expect(updatedChat?.id).toBe(chat?.id);
    expect(updatedChat?.messages[2]?.text).toBe("Web follow-up");
    expect(updatedChat?.messages[3]?.text).toBe("Response to: Web follow-up");

    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("WhatsApp follow-up"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    const whatsAppChat =
      await orquestrator.messagingService.getChatByChannelAddress(
        phoneNumber,
        ChatChannel.WhatsApp,
      );
    expect(whatsAppChat?.id).toBe(chat?.id);
    expect(whatsAppChat?.messages[4]?.text).toBe("WhatsApp follow-up");
  });

  test("handleWebGoogleRedirect syncs email onto existing user chats", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    const email = "savegooglecredentials@example.com";
    const user = new User("Web Sync User", phoneNumber, email);
    user.createGoogleCredential("access", "refresh", 3600);
    await orquestrator.authService.createUser(user);
    const service = orquestrator.messagingService as unknown as {
      createChat: (chat: Chat) => Promise<void>;
    };
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, phoneNumber);
    chat.addUser(user.id);
    chat.addUserTextMessage("existing chat");
    await service.createChat(chat);

    await orquestrator.authService.handleWebGoogleRedirect("rightCode");

    const syncedChat =
      await orquestrator.messagingService.getChatByChannelAddress(
        email,
        ChatChannel.Web,
      );
    expect(syncedChat?.id).toBe(chat.id);
    expect(syncedChat?.webAddress).toBe(email);
  });

  test("sendTextMessage persists messages for Web recipients", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: TestWhatsAppMessagingGateway.phoneNumber,
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "seed web chat",
    });
    await new Promise((r) => setTimeout(r, delay));

    await orquestrator.messagingService.sendTextMessage(
      { channel: ChatChannel.Web, toAddress: webAddress },
      "Forced web",
    );

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat?.messages.at(-1)?.text).toBe("Forced web");
  });

  test("receiveWhatsAppMessage rejects invalid signatures", async () => {
    const gateway = orquestrator.whatsAppMessagingGateway;
    const validateSignature = gateway.validateSignature;
    gateway.validateSignature = () => false;

    await expect(
      orquestrator.messagingService.receiveWhatsAppMessage(
        createReceiveMessage("blocked"),
        "sig",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    gateway.validateSignature = validateSignature;
  });

  test("receiveWhatsAppMessage ignores payloads when the gateway returns nothing", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);

    const gateway = orquestrator.whatsAppMessagingGateway;
    const receiveWhatsAppMessage = gateway.receiveWhatsAppMessage;
    gateway.receiveWhatsAppMessage = () => undefined;

    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("ignored"),
      "sig",
    );

    const chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeUndefined();

    gateway.receiveWhatsAppMessage = receiveWhatsAppMessage;
  });

  test("receiveWebMessage with audio returns the persisted transcript", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    const chat = await orquestrator.messagingService.receiveWebMessage(
      webAddress,
      {
        audioBuffer: Buffer.from("audio-content"),
        mimeType: "audio/mp4; codecs=mp4a.40.2",
      },
    );
    expect(chat?.messages).toHaveLength(3);
    expect(chat?.messages[0]?.content.type).toBe(MessageContentType.Audio);
    expect(chat?.messages[0]?.transcript).toBe(
      "This is a mock transcript for testing purposes.",
    );
    expect(chat?.messages[0]?.mediaUrl).toContain(
      `https://test-storage.example.com/audio/${chat?.id}/`,
    );
    expect(chat?.messages[0]?.mimeType).toBe("audio/mp4; codecs=mp4a.40.2");
    expect(chat?.messages[1]?.text).not.toBeUndefined();
    expect(chat?.messages[1]?.audience).toBe(MessageAudience.Channel);
    expect(chat?.getModelMessages().map((m) => m.id)).not.toContain(
      chat?.messages[1]?.id,
    );
    expect(chat?.messages[2]?.text).toBe(
      "Response to: This is a mock transcript for testing purposes.",
    );

    const transcripts = await orquestrator.getTranscripts(webAddress);
    expect(transcripts).toHaveLength(1);
    expect(transcripts[0]?.transcript).toBe(
      "This is a mock transcript for testing purposes.",
    );
    expect(transcripts[0]?.mimeType).toBe("audio/mp4; codecs=mp4a.40.2");
    expect(transcripts[0]?.mediaUrl).toContain(
      `https://test-storage.example.com/audio/${chat?.id}/`,
    );
  });

  test("respondToMessage returns early for incomplete audio messages", async () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, "5511912345678");
    const message = new Message({
      idChat: chat.id,
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Audio, mimeType: "audio/ogg" },
    });

    await expect(
      orquestrator.messagingService.respondToMessage(
        chat,
        message,
        ChatChannel.WhatsApp,
      ),
    ).resolves.toBeUndefined();
  });

  test("sendButtonReplyMessage persists messages for Web recipients", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: TestWhatsAppMessagingGateway.phoneNumber,
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "seed",
    });
    await new Promise((r) => setTimeout(r, delay));

    await orquestrator.messagingService.sendButtonReplyMessage(
      { channel: ChatChannel.Web, toAddress: webAddress },
      "Pick one",
      ["Yes", "No"],
    );

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat?.messages.at(-1)).toMatchObject({
      text: "Pick one",
      buttonReplyOptions: ["Yes", "No"],
    });
  });

  test("messaging operations requiring a chat throw when none exists", async () => {
    await orquestrator.clearDatabase();

    await expect(
      orquestrator.messagingService.sendTextMessage("5511912345678", "missing"),
    ).rejects.toBeInstanceOf(ValidationException);
    await expect(
      orquestrator.messagingService.sendButtonReplyMessage(
        "5511912345678",
        "missing",
        ["A"],
      ),
    ).rejects.toBeInstanceOf(ValidationException);
    await expect(
      orquestrator.messagingService.deleteChat("5511912345678"),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  test("deleteChat hides the chat and validateWebhook rejects invalid tokens", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("Delete me"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));

    await orquestrator.messagingService.deleteChat(phoneNumber);
    expect(
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber),
    ).toBeUndefined();

    const gateway = orquestrator.whatsAppMessagingGateway;
    const validateWebhook = gateway.validateWebhook;
    gateway.validateWebhook = () => false;

    expect(() =>
      orquestrator.messagingService.validateWebhook("subscribe", "bad-token"),
    ).toThrow(ValidationException);

    gateway.validateWebhook = validateWebhook;
  });

  test("internal helpers cover mime mappings and invalid chat types", async () => {
    const service = orquestrator.messagingService as unknown as {
      getExtension: (mimeType: string) => string;
      getMessagingGatewayByChannel: (channel: ChatChannel) => unknown;
    };

    expect(service.getExtension("audio/ogg")).toBe(".ogg");
    expect(service.getExtension("audio/mp3")).toBe(".mp3");
    expect(service.getExtension("audio/m4a")).toBe(".m4a");
    expect(service.getExtension("audio/aac")).toBe(".aac");
    expect(service.getExtension("audio/amr")).toBe(".amr");
    expect(service.getExtension("audio/webm")).toBe(".webm");
    expect(service.getExtension("audio/wave")).toBe(".wav");
    expect(service.getExtension("application/octet-stream")).toBe(".bin");

    expect(() =>
      service.getMessagingGatewayByChannel("unsupported" as ChatChannel),
    ).toThrow(ValidationException);
  });

  test("respondToMessage sends interactive buttons when the AI requests them", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    const aiGateway = orquestrator.aiGateway;
    aiGateway.scriptedResponses = [
      {
        content: { type: "button", text: "Choose", options: ["A", "B"] },
        toolCalls: [],
        finishReason: "stop",
      },
    ];

    const chat = await orquestrator.messagingService.receiveWebMessage(
      webAddress,
      {
        text: "Need choices",
      },
    );
    expect(chat?.messages.at(-1)).toMatchObject({
      text: "Choose",
      buttonReplyOptions: ["A", "B"],
    });
  });

  test("tool calls persist before execution and results feed the follow-up call", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    const aiGateway = orquestrator.aiGateway;
    aiGateway.requests = [];
    aiGateway.scriptedResponses = [
      {
        toolCalls: [
          {
            type: MessageContentType.ToolCall,
            callId: "call-1",
            name: "list_todos",
            arguments: { status: "Pending" },
          },
        ],
        finishReason: "tool_calls",
      },
    ];

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "list my todos",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat?.messages).toHaveLength(4);
    const userMessage = chat?.messages[0];
    const toolCallMessage = chat?.messages[1];
    expect(toolCallMessage?.role).toBe(MessageRole.Assistant);
    expect(toolCallMessage?.audience).toBe(MessageAudience.Model);
    expect(toolCallMessage?.turnId).toBe(userMessage?.id);
    expect(toolCallMessage?.content).toMatchObject({
      type: MessageContentType.ToolCall,
      callId: "call-1",
      name: "list_todos",
    });
    const toolResultMessage = chat?.messages[2];
    expect(toolResultMessage?.role).toBe(MessageRole.Tool);
    expect(toolResultMessage?.turnId).toBe(userMessage?.id);
    expect(toolResultMessage?.content).toMatchObject({
      type: MessageContentType.ToolResult,
      callId: "call-1",
      outcome: { status: ToolResultStatus.Succeeded, data: { count: 0 } },
    });
    expect(chat?.messages[3]?.role).toBe(MessageRole.Assistant);
    expect(chat?.messages[3]?.text).toBeDefined();

    const followUp = aiGateway.requests[aiGateway.requests.length - 1];
    expect(
      followUp?.messages.some(
        (m) => m.content.type === MessageContentType.ToolCall,
      ),
    ).toBe(true);
    expect(
      followUp?.messages.some(
        (m) => m.content.type === MessageContentType.ToolResult,
      ),
    ).toBe(true);

    expect(chat?.getChannelMessages()).toHaveLength(2);
    expect(chat?.toJSON().messages).toHaveLength(2);
  });

  test("unknown tools and malformed arguments become persisted failed results", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    const aiGateway = orquestrator.aiGateway;
    aiGateway.scriptedResponses = [
      {
        toolCalls: [
          {
            type: MessageContentType.ToolCall,
            callId: "call-unknown",
            name: "does_not_exist",
            arguments: {},
          },
          {
            type: MessageContentType.ToolCall,
            callId: "call-malformed",
            name: "list_todos",
            arguments: "{not json",
          },
        ],
        finishReason: "tool_calls",
      },
    ];

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "break the tools",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat?.messages).toHaveLength(6);
    const turnId = chat?.messages[0]?.turnId ?? "";
    expect(chat?.getToolResult(turnId, "call-unknown")?.content).toMatchObject({
      type: MessageContentType.ToolResult,
      outcome: { status: ToolResultStatus.Failed, code: "UnknownTool" },
    });
    expect(
      chat?.getToolResult(turnId, "call-malformed")?.content,
    ).toMatchObject({
      type: MessageContentType.ToolResult,
      outcome: { status: ToolResultStatus.Failed, code: "InvalidArguments" },
    });
    expect(chat?.messages[5]?.role).toBe(MessageRole.Assistant);
    expect(chat?.messages[5]?.audience).toBe(MessageAudience.Both);
  });

  test("persisted results prevent duplicate execution and unknown outcomes are not retried", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    const aiGateway = orquestrator.aiGateway;
    const service = orquestrator.messagingService as unknown as {
      aiToolService: AiToolService;
    };
    const execute = service.aiToolService.execute;
    let executions = 0;
    service.aiToolService.execute = async (call) => {
      executions++;
      return {
        type: MessageContentType.ToolResult,
        callId: call.callId,
        outcome: {
          status: ToolResultStatus.Unknown,
          code: "UnconfirmedOutcome",
          message: "confirmation lost",
        },
      };
    };
    aiGateway.scriptedResponses = [
      {
        toolCalls: [
          {
            type: MessageContentType.ToolCall,
            callId: "call-dup",
            name: "add_transaction",
            arguments: { type: "Expense", user_message: "50", value: 50 },
          },
        ],
        finishReason: "tool_calls",
      },
      {
        toolCalls: [
          {
            type: MessageContentType.ToolCall,
            callId: "call-dup",
            name: "add_transaction",
            arguments: { type: "Expense", user_message: "50", value: 50 },
          },
        ],
        finishReason: "tool_calls",
      },
    ];

    try {
      await orquestrator.messagingService.receiveWebMessage(webAddress, {
        text: "add 50",
      });
      await new Promise((r) => setTimeout(r, delay));

      const chat = await orquestrator.messagingService.getChatByChannelAddress(
        webAddress,
        ChatChannel.Web,
      );
      expect(executions).toBe(1);
      const turnId = chat?.messages[0]?.turnId ?? "";
      const results = chat?.messages.filter(
        (m) =>
          m.content.type === MessageContentType.ToolResult &&
          m.content.callId === "call-dup",
      );
      expect(results).toHaveLength(1);
      expect(chat?.getToolResult(turnId, "call-dup")?.content).toMatchObject({
        type: MessageContentType.ToolResult,
        outcome: { status: ToolResultStatus.Unknown },
      });
    } finally {
      service.aiToolService.execute = execute;
    }
  });

  test("multiple tool calls persist in provider order before executing", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    const aiGateway = orquestrator.aiGateway;
    aiGateway.scriptedResponses = [
      {
        toolCalls: [
          {
            type: MessageContentType.ToolCall,
            callId: "call-a",
            name: "list_todos",
            arguments: { status: "Pending" },
          },
          {
            type: MessageContentType.ToolCall,
            callId: "call-b",
            name: "list_todos",
            arguments: { status: "Completed" },
          },
        ],
        finishReason: "tool_calls",
      },
    ];

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "list everything",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    const kinds = chat?.messages.map((m) => {
      if (m.content.type === MessageContentType.ToolCall)
        return `call:${m.content.callId}`;
      if (m.content.type === MessageContentType.ToolResult)
        return `result:${m.content.callId}`;
      return m.content.type;
    });
    expect(kinds).toEqual([
      "text",
      "call:call-a",
      "call:call-b",
      "result:call-a",
      "result:call-b",
      "text",
    ]);
  });

  test("the maximum tool-round limit terminates the loop with a safe reply", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    const aiGateway = orquestrator.aiGateway;
    const maxToolRounds = orquestrator.aiConfig.maxToolRounds;
    aiGateway.scriptedResponses = Array.from(
      { length: maxToolRounds + 2 },
      (_, i) => ({
        toolCalls: [
          {
            type: MessageContentType.ToolCall,
            callId: `call-${i}`,
            name: "list_todos",
            arguments: { status: "Pending" },
          },
        ],
        finishReason: "tool_calls",
      }),
    );

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "never finish",
    });
    await new Promise((r) => setTimeout(r, delay * 5));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    const toolCallCount = chat?.messages.filter(
      (m) => m.content.type === MessageContentType.ToolCall,
    ).length;
    expect(toolCallCount).toBe(maxToolRounds);
    const lastMessage = chat?.messages[chat.messages.length - 1];
    expect(lastMessage?.role).toBe(MessageRole.Assistant);
    expect(lastMessage?.text).toContain("limite de operações");
    aiGateway.scriptedResponses = [];
  });

  test("create_todos binds created todos to the source message", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    const aiGateway = orquestrator.aiGateway;
    aiGateway.scriptedResponses = [
      {
        toolCalls: [
          {
            type: MessageContentType.ToolCall,
            callId: "call-todo",
            name: "create_todos",
            arguments: {
              todos: [{ name: "Buy milk", status: "Pending" }],
            },
          },
        ],
        finishReason: "tool_calls",
      },
    ];

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "remember to buy milk",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    const todos = await orquestrator.todoService.listTodos(user.id, {});
    expect(todos).toHaveLength(1);
    expect(todos[0]?.name).toBe("Buy milk");
    expect(todos[0]?.idSourceMessage).toBe(chat?.messages[0]?.id);
    const turnId = chat?.messages[0]?.turnId ?? "";
    expect(chat?.getToolResult(turnId, "call-todo")?.content).toMatchObject({
      type: MessageContentType.ToolResult,
      outcome: { status: ToolResultStatus.Succeeded },
    });
  });

  test("listenToMessage falls back to an empty text payload for unknown shapes", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);

    await orquestrator.messagingService.listenToMessage({
      fromAddress: phoneNumber,
      channelMessageId: uuidv4(),
      channel: ChatChannel.WhatsApp,
    } as never);
    await new Promise((r) => setTimeout(r, delay));

    const chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat?.messages[0]?.text).toBe("");
  });

  test("sendSignedInMessage persists signed-in copy for an existing chat", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });
    await orquestrator.messagingService.listenToMessage({
      fromAddress: phoneNumber,
      channelMessageId: uuidv4(),
      channel: ChatChannel.WhatsApp,
      text: "seed",
    } as never);

    await orquestrator.messagingService.sendSignedInMessage(phoneNumber);

    const savedChat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(savedChat?.messages[0]?.text).toBe("seed");
    expect(savedChat?.messages.at(-1)?.text).toContain(
      "Conectado com o Google",
    );
  });

  test("dual-ID webhook keeps phone-valued whatsapp_address", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    const bsuid = TestWhatsAppMessagingGateway.bsuid;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });

    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("legacy phone chat"),
      "sig",
    );
    await orquestrator.messagingService.receiveWhatsAppMessage(
      JSON.stringify({ dualIdWebhook: true }),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      phoneNumber,
      ChatChannel.WhatsApp,
    );
    expect(chat?.whatsAppAddress).toBe(phoneNumber);
    expect(
      await orquestrator.messagingService.getChatByChannelAddress(
        bsuid,
        ChatChannel.WhatsApp,
      ),
    ).toBeUndefined();

    const allowed = await orquestrator.database.sql<
      { channel_address: string }[]
    >`
      SELECT channel_address FROM allowed_entries
      WHERE channel = ${ChatChannel.WhatsApp}
      AND channel_address = ${phoneNumber}
    `;
    expect(allowed.length).toBe(1);

    const user =
      await orquestrator.authService.getUserByPhoneNumber(phoneNumber);
    expect(user?.bsuid).toBeUndefined();
  });

  test("deleteUserByChatChannelAddress deletes a dual-ID phone chat", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });

    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("legacy phone chat"),
      "sig",
    );
    await orquestrator.messagingService.receiveWhatsAppMessage(
      JSON.stringify({ dualIdWebhook: true }),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));

    expect(
      await orquestrator.messagingService.getChatByChannelAddress(
        phoneNumber,
        ChatChannel.WhatsApp,
      ),
    ).toBeDefined();

    await orquestrator.deleteUser(phoneNumber);

    expect(
      await orquestrator.authService.getUserByPhoneNumber(phoneNumber),
    ).toBeUndefined();
    expect(
      await orquestrator.messagingService.getChatByChannelAddress(
        phoneNumber,
        ChatChannel.WhatsApp,
      ),
    ).toBeUndefined();
  });

  test("getChatByChannelAddress without channel finds web chat by email", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);
    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "web lookup",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat =
      await orquestrator.messagingService.getChatByChannelAddress(webAddress);
    expect(chat?.channel).toBe(ChatChannel.Web);
    expect(chat?.webAddress).toBe(webAddress);
  });

  test("deleteUserByChatChannelAddress deletes a web chat by email", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);
    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "delete me",
    });
    await new Promise((r) => setTimeout(r, delay));

    await orquestrator.deleteUser(webAddress);

    expect(
      await orquestrator.authService.getUserByEmail(webAddress),
    ).toBeUndefined();
    expect(
      await orquestrator.messagingService.getChatByChannelAddress(webAddress),
    ).toBeUndefined();
  });

  test("isAllowedChannelAddress accepts BSUID-valued allowlist rows", async () => {
    await orquestrator.clearDatabase();
    const bsuid = TestWhatsAppMessagingGateway.bsuid;
    await orquestrator.addAllowedWhatsAppId(bsuid);

    await orquestrator.messagingService.receiveWhatsAppMessage(
      JSON.stringify({ bsuidOnlyWebhook: true }),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      bsuid,
      ChatChannel.WhatsApp,
    );
    expect(chat?.whatsAppAddress).toBe(bsuid);
  });

  test("BSUID provider APIs find chats without phone normalization", async () => {
    await orquestrator.clearDatabase();
    const bsuid = TestWhatsAppMessagingGateway.bsuid;
    await orquestrator.addAllowedWhatsAppId(bsuid);
    await orquestrator.createUser({ bsuid });

    await orquestrator.messagingService.receiveWhatsAppMessage(
      JSON.stringify({ bsuidOnlyWebhook: true }),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));

    const transcripts = await orquestrator.getTranscripts(bsuid);
    expect(transcripts).toHaveLength(0);

    await orquestrator.messagingService.deleteChat(bsuid);
    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      bsuid,
      ChatChannel.WhatsApp,
    );
    expect(chat).toBeUndefined();
  });
});
