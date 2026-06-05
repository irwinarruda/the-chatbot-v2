import { v4 as uuidv4 } from "uuid";
import { Encryption } from "~/infra/encryption";
import { UnauthorizedException, ValidationException } from "~/infra/exceptions";
import { AiChatMessageType } from "~/server/resources/IAiChatGateway";
import type { TestAiChatGateway } from "~/server/resources/TestAiChatGateway";
import type { TestWebMessagingGateway } from "~/server/resources/TestWebMessagingGateway";
import { TestWhatsAppMessagingGateway } from "~/server/resources/TestWhatsAppMessagingGateway";
import { Chat } from "~/shared/entities/Chat";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";
import { Message } from "~/shared/entities/Message";
import { User } from "~/shared/entities/User";
import { orquestrator } from "./orquestrator";

function createReceiveMessage(message: string): string {
  return JSON.stringify(message);
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
    expect(userMessage?.userType).toBe(MessageUserType.User);
    const responseMessage = chat?.messages[1];
    expect(responseMessage?.text).toBe("Response to: User 1");
    expect(responseMessage?.userType).toBe(MessageUserType.Bot);
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
    expect(userMessage?.userType).toBe(MessageUserType.User);
    let botMessage = chat?.messages[1];
    expect(botMessage).toBeDefined();
    expect(botMessage?.text).toContain("\ud83d\udc4b");
    expect(botMessage?.text).toContain("id=5511984444444");

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

  test("summarizationShouldNotTriggerBeforeThreshold", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);
    await orquestrator.createUser({ phoneNumber });
    for (let i = 0; i < 9; i++) {
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
    expect(chat?.messages.length).toBe(18);
    expect(chat?.summary).toBeUndefined();
    expect(chat?.summarizedUntilId).toBeUndefined();
    expect(chat?.effectiveMessages.length).toBe(18);
  });

  test("summarizationTriggeredAfterThreshold", async () => {
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
    expect(chat?.summary).toBeDefined();
    expect(chat?.summary).toContain("Summary of 20 messages");
    expect(chat?.summarizedUntilId).toBeDefined();
    expect(chat?.effectiveMessages.length).toBe(0);
  });

  test("summarizationIncrementedOnNextThreshold", async () => {
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
    let chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    const firstSummary = chat?.summary;
    expect(firstSummary).toBeDefined();
    for (let i = 10; i < 20; i++) {
      await orquestrator.messagingService.receiveWhatsAppMessage(
        createReceiveMessage(`Message ${i}`),
        "sig",
      );
      await new Promise((r) => setTimeout(r, delay));
    }
    await new Promise((r) => setTimeout(r, 100));
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.messages.length).toBe(40);
    expect(chat?.summary).toBeDefined();
    expect(chat?.summary).toContain(firstSummary ?? "");
    expect(chat?.summary).toContain(
      "Summary of 20 messages + Summary of 20 messages",
    );
  });

  test("chatEffectiveMessagesReturnsAllWhenSummarizedIdNotFound", () => {
    const chat = new Chat();
    chat.setChannelAddress(
      ChatChannel.WhatsApp,
      TestWhatsAppMessagingGateway.phoneNumber,
    );
    chat.addUserTextMessage("Hello");
    chat.addBotTextMessage("Hi there");
    chat.setSummary("Some summary", uuidv4());
    expect(chat.effectiveMessages.length).toBe(2);
  });

  test("receiveWebMessage creates Web chat and responds via web gateway", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    const webGateway = orquestrator.container.resolve<TestWebMessagingGateway>(
      "IWebMessagingGateway",
    );
    const eventsBefore = webGateway.getEvents().length;
    const incomingWebAddress = webAddress.toUpperCase();

    await orquestrator.messagingService.receiveWebMessage(incomingWebAddress, {
      text: "Hello from web",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat).toBeDefined();
    expect(chat?.channel).toBe(ChatChannel.Web);
    expect(chat?.webAddress).toBe(webAddress);
    expect(chat?.idUser).toBe(user.id);
    expect(chat?.messages.length).toBe(2);
    expect(chat?.messages[0]?.text).toBe("Hello from web");
    expect(chat?.messages[0]?.userType).toBe(MessageUserType.User);
    expect(chat?.messages[1]?.userType).toBe(MessageUserType.Bot);
    expect(chat?.messages[1]?.text).toBe("Response to: Hello from web");

    const events = webGateway.getEvents();
    expect(events.length).toBeGreaterThan(eventsBefore);
    const lastEvent = events[events.length - 1];
    expect(lastEvent?.type).toBe("text");
    expect(
      (lastEvent?.data as { toAddress: string; text: string }).toAddress,
    ).toBe(webAddress);
    expect((lastEvent?.data as { toAddress: string; text: string }).text).toBe(
      "Response to: Hello from web",
    );
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
    expect(chat?.messages[0]?.userType).toBe(MessageUserType.User);
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

  test("subscribeToWebEvents yields enqueued events and stops on abort", async () => {
    const webAddress = "subscriber@example.com";
    const webGateway = orquestrator.container.resolve<TestWebMessagingGateway>(
      "IWebMessagingGateway",
    );
    webGateway.clearEvents();

    const controller = new AbortController();
    const generator = await orquestrator.messagingService.subscribeToWebEvents(
      webAddress,
      controller.signal,
    );

    webGateway.enqueue(webAddress, {
      type: "text",
      data: { toAddress: webAddress, text: "hello subscriber" },
    });

    const first = await generator.next();
    expect(first.done).toBe(false);
    expect(first.value?.type).toBe("text");
    expect((first.value?.data as { text: string }).text).toBe(
      "hello subscriber",
    );

    controller.abort();
    const next = await generator.next();
    expect(next.done).toBe(true);
  });

  test("handleGoogleRedirect syncs email onto an existing WhatsApp chat", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);

    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("WhatsApp history"),
      "sig",
    );
    const state = new Encryption(orquestrator.encryptionConfig).encrypt(
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
    const webGateway = orquestrator.container.resolve<TestWebMessagingGateway>(
      "IWebMessagingGateway",
    );
    webGateway.clearEvents();
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
    const events = webGateway.getEvents();
    expect(events[events.length - 1]).toMatchObject({
      type: "text",
      data: {
        toAddress: user?.email,
        text: "Response to: Web follow-up",
      },
    });

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

  test("sendTextMessage routes to web gateway when recipient is web", async () => {
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

    const webGateway = orquestrator.container.resolve<TestWebMessagingGateway>(
      "IWebMessagingGateway",
    );
    const eventsBefore = webGateway.getEvents().length;

    await orquestrator.messagingService.sendTextMessage(
      { channel: ChatChannel.Web, toAddress: webAddress },
      "Forced web",
    );

    const events = webGateway.getEvents();
    expect(events.length).toBe(eventsBefore + 1);
    const lastEvent = events[events.length - 1];
    expect(lastEvent?.type).toBe("text");
    expect((lastEvent?.data as { text: string }).text).toBe("Forced web");
  });

  test("receiveWhatsAppMessage rejects invalid signatures", async () => {
    const gateway =
      orquestrator.container.resolve<TestWhatsAppMessagingGateway>(
        "IWhatsAppMessagingGateway",
      );
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

    const gateway =
      orquestrator.container.resolve<TestWhatsAppMessagingGateway>(
        "IWhatsAppMessagingGateway",
      );
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

  test("receiveWebMessage with audio uploads, transcribes, and exposes transcript events", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    const webGateway = orquestrator.container.resolve<TestWebMessagingGateway>(
      "IWebMessagingGateway",
    );
    webGateway.clearEvents();

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      audioBuffer: Buffer.from("audio-content"),
      mimeType: "audio/mp4; codecs=mp4a.40.2",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(chat?.messages).toHaveLength(3);
    expect(chat?.messages[0]?.type).toBe(MessageType.Audio);
    expect(chat?.messages[0]?.transcript).toBe(
      "This is a mock transcript for testing purposes.",
    );
    expect(chat?.messages[0]?.mediaUrl).toContain(
      `https://test-storage.example.com/audio/${chat?.id}/`,
    );
    expect(chat?.messages[0]?.mimeType).toBe("audio/mp4; codecs=mp4a.40.2");
    expect(chat?.messages[1]?.text).not.toBeUndefined();
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

    const events = webGateway.getEvents();
    expect(events.map((event) => event.type)).toEqual([
      "text",
      "audio",
      "text",
    ]);
    expect(events[1]).toMatchObject({
      type: "audio",
      data: {
        mimeType: "audio/mp4",
        transcript: "This is a mock transcript for testing purposes.",
      },
    });
  });

  test("respondToMessage returns early for incomplete audio messages", async () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, "5511912345678");
    const message = new Message({
      idChat: chat.id,
      type: MessageType.Audio,
      userType: MessageUserType.User,
    });

    await expect(
      orquestrator.messagingService.respondToMessage(
        chat,
        message,
        ChatChannel.WhatsApp,
      ),
    ).resolves.toBeUndefined();
  });

  test("sendButtonReplyMessage routes to web gateway when recipient is web", async () => {
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

    const webGateway = orquestrator.container.resolve<TestWebMessagingGateway>(
      "IWebMessagingGateway",
    );
    webGateway.clearEvents();

    await orquestrator.messagingService.sendButtonReplyMessage(
      { channel: ChatChannel.Web, toAddress: webAddress },
      "Pick one",
      ["Yes", "No"],
    );

    const events = webGateway.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "interactive_button",
      data: {
        toAddress: webAddress,
        text: "Pick one",
        buttons: ["Yes", "No"],
      },
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

    const gateway =
      orquestrator.container.resolve<TestWhatsAppMessagingGateway>(
        "IWhatsAppMessagingGateway",
      );
    const validateWebhook = gateway.validateWebhook;
    gateway.validateWebhook = () => false;

    expect(() =>
      orquestrator.messagingService.validateWebhook("subscribe", "bad-token"),
    ).toThrow(ValidationException);

    gateway.validateWebhook = validateWebhook;
  });

  test("internal helpers cover mime mappings, ai parsing, summarization failures, and invalid chat types", async () => {
    const service = orquestrator.messagingService as unknown as {
      getExtension: (mimeType: string) => string;
      parseMessagesToAi: (messages: Message[]) => unknown[];
      triggerSummarization: (chat: Chat) => Promise<void>;
      getMessagingGatewayByChannel: (channel: ChatChannel) => unknown;
      aiChatGateway: {
        getResponse: (
          channelAddress: string,
          messages: unknown[],
        ) => Promise<{
          type: AiChatMessageType;
          text: string;
          buttons: string[];
        }>;
        generateSummary: (
          messages: unknown[],
          summary?: string,
        ) => Promise<string>;
      };
    };

    expect(service.getExtension("audio/ogg")).toBe(".ogg");
    expect(service.getExtension("audio/mp3")).toBe(".mp3");
    expect(service.getExtension("audio/m4a")).toBe(".m4a");
    expect(service.getExtension("audio/aac")).toBe(".aac");
    expect(service.getExtension("audio/amr")).toBe(".amr");
    expect(service.getExtension("audio/webm")).toBe(".webm");
    expect(service.getExtension("audio/wave")).toBe(".wav");
    expect(service.getExtension("application/octet-stream")).toBe(".bin");

    const textMessage = new Message({
      idChat: "chat-1",
      type: MessageType.Text,
      userType: MessageUserType.Bot,
      text: "bot text",
    });
    const buttonMessage = new Message({
      idChat: "chat-1",
      type: MessageType.ButtonReply,
      userType: MessageUserType.User,
      buttonReply: "Yes",
      buttonReplyOptions: ["Yes", "No"],
    });
    const transcriptMessage = new Message({
      idChat: "chat-1",
      type: MessageType.Audio,
      userType: MessageUserType.User,
    });
    transcriptMessage.transcript = "voice text";

    expect(
      service.parseMessagesToAi([
        textMessage,
        buttonMessage,
        transcriptMessage,
      ]),
    ).toEqual([
      {
        role: "assistant",
        type: "text",
        text: "bot text",
        buttons: [],
      },
      {
        role: "user",
        type: "button",
        text: "Yes",
        buttons: ["Yes", "No"],
      },
      {
        role: "user",
        type: "text",
        text: "voice text",
        buttons: [],
      },
    ]);

    const generateSummary = service.aiChatGateway.generateSummary;
    service.aiChatGateway.generateSummary = async () => {
      throw new Error("boom");
    };

    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, "5511912345678");
    chat.addUserTextMessage("hello");
    chat.addBotTextMessage("world");
    await expect(service.triggerSummarization(chat)).resolves.toBeUndefined();
    expect(chat.summary).toBeUndefined();

    service.aiChatGateway.generateSummary = generateSummary;

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

    const service = orquestrator.messagingService as unknown as {
      aiChatGateway: {
        getResponse: (
          channelAddress: string,
          messages: unknown[],
        ) => Promise<{
          type: AiChatMessageType;
          text: string;
          buttons: string[];
        }>;
      };
    };
    const getResponse = service.aiChatGateway.getResponse;
    service.aiChatGateway.getResponse = async () => ({
      type: AiChatMessageType.Button,
      text: "Choose",
      buttons: ["A", "B"],
    });

    const webGateway = orquestrator.container.resolve<TestWebMessagingGateway>(
      "IWebMessagingGateway",
    );
    webGateway.clearEvents();

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "Need choices",
    });
    await new Promise((r) => setTimeout(r, delay));

    const events = webGateway.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "interactive_button",
      data: { text: "Choose", buttons: ["A", "B"] },
    });

    service.aiChatGateway.getResponse = getResponse;
  });

  test("respondToMessage passes idSourceMessage in AI context", async () => {
    await orquestrator.clearDatabase();
    const user = await orquestrator.createUser({
      phoneNumber: "5511912345678",
    });
    const webAddress = user.email ?? "";
    await orquestrator.addAllowedWebId(webAddress);

    const aiGateway =
      orquestrator.container.resolve<TestAiChatGateway>("IAiChatGateway");

    await orquestrator.messagingService.receiveWebMessage(webAddress, {
      text: "remember this",
    });
    await new Promise((r) => setTimeout(r, delay));

    const chat = await orquestrator.messagingService.getChatByChannelAddress(
      webAddress,
      ChatChannel.Web,
    );
    expect(aiGateway.lastChannelAddress).toBe(webAddress);
    expect(aiGateway.lastContext?.idSourceMessage).toBe(chat?.messages[0]?.id);
    expect(aiGateway.lastContext).not.toHaveProperty("idUser");
    expect(aiGateway.lastContext).not.toHaveProperty("channelAddress");
    expect(aiGateway.lastContext).not.toHaveProperty("channel");
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

  test("internal helpers persist preloaded chat messages and send signed-in copy", async () => {
    await orquestrator.clearDatabase();
    const service = orquestrator.messagingService as unknown as {
      createChat: (chat: Chat) => Promise<void>;
    };
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.addAllowedNumber(phoneNumber);

    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, phoneNumber);
    chat.addUserTextMessage("seed");
    await service.createChat(chat);

    await orquestrator.messagingService.sendSignedInMessage(phoneNumber);

    const savedChat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(savedChat?.messages[0]?.text).toBe("seed");
    expect(savedChat?.messages[1]?.text).toContain("Conectado com o Google");
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
