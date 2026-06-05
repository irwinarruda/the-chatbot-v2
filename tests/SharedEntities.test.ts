import { ValidationException } from "~/infra/exceptions";
import { BsuidUtils } from "~/shared/entities/BsuidUtils";
import { CashFlowSpreadsheet } from "~/shared/entities/CashFlowSpreadsheet";
import { Chat } from "~/shared/entities/Chat";
import { Credential } from "~/shared/entities/Credentials";
import { CashFlowSpreadsheetType } from "~/shared/entities/enums/CashFlowSpreadsheetType";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";
import { CredentialType } from "~/shared/entities/enums/CredentialType";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";
import { Message } from "~/shared/entities/Message";
import { PhoneNumberUtils } from "~/shared/entities/PhoneNumberUtils";
import { User } from "~/shared/entities/User";

describe("shared entities", () => {
  test("Chat handles provider IDs, summarization, validation, and serialization", () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.WhatsApp, "5511984444444");
    expect(chat.whatsAppAddress).toBe("5511984444444");
    expect(chat.webAddress).toBeUndefined();
    chat.setChannelAddress(ChatChannel.Web, "User@Example.com");
    expect(chat.webAddress).toBe("user@example.com");
    expect(() => chat.setChannelAddress(ChatChannel.WhatsApp, "")).toThrow(
      ValidationException,
    );

    const firstUserMessage = chat.addUserTextMessage("hello", "provider-1");
    const botMessage = chat.addBotTextMessage("hi", "provider-2");
    const buttonMessage = chat.addUserButtonReply("yes", "provider-3");
    const buttonReply = chat.addBotButtonReply(
      "choose",
      ["A", "B"],
      "provider-4",
    );
    const audioMessage = chat.addUserAudioMessage(
      "media-1",
      "audio/webm",
      "provider-5",
    );

    expect(chat.effectiveMessages).toHaveLength(5);
    expect(chat.shouldSummarize(10)).toBe(false);
    expect(chat.shouldSummarize(5)).toBe(true);
    expect(chat.getChannelAddress()).toBe("user@example.com");

    chat.summarizedUntilId = buttonMessage.id;
    expect(chat.effectiveMessages).toEqual(chat.messages);

    chat.summary = "summary";
    expect(chat.effectiveMessages).toEqual([buttonReply, audioMessage]);
    expect(chat.shouldSummarize(10)).toBe(false);

    chat.summary = undefined;
    expect(chat.shouldSummarize(10)).toBe(true);

    chat.setSummary("fresh summary", firstUserMessage.id);
    expect(chat.summary).toBe("fresh summary");
    expect(chat.effectiveMessages).toEqual([
      botMessage,
      buttonMessage,
      buttonReply,
      audioMessage,
    ]);

    chat.addUser("user-1");
    expect(() => chat.addUser("user-2")).toThrow(ValidationException);

    const serialized = chat.toJSON();
    expect(serialized.channel).toBe("web");
    expect(serialized.whatsAppAddress).toBe("5511984444444");
    expect(serialized.webAddress).toBe("user@example.com");
    expect(serialized.messages).toHaveLength(5);

    chat.deleteChat();
    expect(chat.isDeleted).toBe(true);
    expect(() => chat.deleteChat()).toThrow(ValidationException);
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

  test("Message serializes lowercase enum values and stores audio metadata", () => {
    const emptyMessage = new Message();
    expect(emptyMessage.idChat).toBe("");
    expect(emptyMessage.type).toBe(MessageType.Text);
    expect(emptyMessage.userType).toBe(MessageUserType.User);

    const message = new Message({
      idChat: "chat-1",
      type: MessageType.Audio,
      userType: MessageUserType.Bot,
      mediaId: "media-1",
      mimeType: "audio/webm",
    });
    message.addAudioTranscriptAndUrl("transcript", "https://example.com/audio");

    expect(message.toJSON()).toMatchObject({
      type: "audio",
      userType: "bot",
      mediaUrl: "https://example.com/audio",
      mimeType: "audio/webm",
      transcript: "transcript",
    });
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
