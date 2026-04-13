import { v4 as uuidv4 } from "uuid";
import { Chat } from "~/entities/Chat";
import { MessageUserType } from "~/entities/enums/MessageUserType";
import { TestWhatsAppMessagingGateway } from "~/resources/TestWhatsAppMessagingGateway";
import { orquestrator } from "./orquestrator";

function createReceiveMessage(message: string): string {
  return JSON.stringify(message);
}

const delay = 10;

describe("MessagingService", () => {
  test("sendMessage", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.messagingService.addAllowedNumber(phoneNumber);
    const user = await orquestrator.createUser({ phoneNumber });
    let chat = await orquestrator.messagingService.getChatByPhoneNumber(
      user.phoneNumber,
    );
    expect(chat).toBeUndefined();
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("User 1"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    chat = await orquestrator.messagingService.getChatByPhoneNumber(
      user.phoneNumber,
    );
    expect(chat).toBeDefined();
    expect(chat?.idUser).toBe(user.id);
    expect(chat?.messages.length).toBe(2);
    const userMessage = chat?.messages[0];
    expect(userMessage?.text).toBe("User 1");
    expect(userMessage?.userType).toBe(MessageUserType.User);
    const responseMessage = chat?.messages[1];
    expect(responseMessage?.text).toBe("Response to: User 1");
    expect(responseMessage?.userType).toBe(MessageUserType.Bot);
    await orquestrator.messagingService.sendTextMessage(
      user.phoneNumber,
      "Bot 1",
    );
    chat = await orquestrator.messagingService.getChatByPhoneNumber(
      user.phoneNumber,
    );
    expect(chat).toBeDefined();
    expect(chat?.messages.length).toBe(3);
  });

  test("receiveMessage", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.messagingService.addAllowedNumber(phoneNumber);
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
    expect(chat?.phoneNumber).toBe(phoneNumber);
    expect(chat?.messages.length).toBe(2);
    let userMessage = chat?.messages[0];
    expect(userMessage).toBeDefined();
    expect(userMessage?.text).toBe("First message");
    expect(userMessage?.userType).toBe(MessageUserType.User);
    let botMessage = chat?.messages[1];
    expect(botMessage).toBeDefined();
    expect(botMessage?.text).toContain("\ud83d\udc4b");

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
    const idProvider = userMessage?.idProvider;
    chat =
      await orquestrator.messagingService.getChatByPhoneNumber(phoneNumber);
    expect(chat).toBeDefined();
    expect(chat?.idUser).toBe(user.id);
    expect(chat?.phoneNumber).toBe(phoneNumber);
    expect(chat?.messages.length).toBe(4);
    userMessage = chat?.messages[2];
    expect(userMessage?.text).toBe("Second duplicate message");
    expect(userMessage?.idProvider).not.toBe(idProvider);
    botMessage = chat?.messages[3];
    expect(botMessage?.text).toBe("Response to: Second duplicate message");
  });

  test("anotherChatShouldBeCreatedWhenUserIsDeleted", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    await orquestrator.messagingService.addAllowedNumber(phoneNumber);
    const user = await orquestrator.createUser({ phoneNumber });
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("Message 1"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    let chat = await orquestrator.messagingService.getChatByPhoneNumber(
      user.phoneNumber,
    );
    expect(chat).toBeDefined();
    expect(chat?.messages.length).toBe(2);
    await orquestrator.deleteUser(phoneNumber);
    chat = await orquestrator.messagingService.getChatByPhoneNumber(
      user.phoneNumber,
    );
    expect(chat).toBeUndefined();
    await orquestrator.messagingService.receiveWhatsAppMessage(
      createReceiveMessage("New message 2"),
      "sig",
    );
    await new Promise((r) => setTimeout(r, delay));
    chat = await orquestrator.messagingService.getChatByPhoneNumber(
      user.phoneNumber,
    );
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
    await orquestrator.messagingService.addAllowedNumber(phoneNumber);
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
    await orquestrator.messagingService.addAllowedNumber(phoneNumber);
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
    await orquestrator.messagingService.addAllowedNumber(phoneNumber);
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
    await orquestrator.messagingService.addAllowedNumber(phoneNumber);
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
    chat.phoneNumber = TestWhatsAppMessagingGateway.phoneNumber;
    chat.addUserTextMessage("Hello");
    chat.addBotTextMessage("Hi there");
    chat.setSummary("Some summary", uuidv4());
    expect(chat.effectiveMessages.length).toBe(2);
  });
});
