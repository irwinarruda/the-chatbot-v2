import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/infra/exceptions";
import { ChatType } from "~/shared/entities/enums/ChatType";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";
import { Message } from "~/shared/entities/Message";

export class Chat {
  id: string;
  idUser?: string;
  phoneNumber: string;
  type: ChatType;
  messages: Message[];
  summary?: string;
  summarizedUntilId?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;

  constructor() {
    this.id = uuidv4();
    this.idUser = undefined;
    this.type = ChatType.WhatsApp;
    this.phoneNumber = "";
    this.messages = [];
    this.summary = undefined;
    this.summarizedUntilId = undefined;
    this.isDeleted = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  get effectiveMessages(): Message[] {
    if (!this.summarizedUntilId) return this.messages;
    if (!this.summary) return this.messages;
    const idx = this.messages.findIndex((m) => m.id === this.summarizedUntilId);
    if (idx < 0) return this.messages;
    return this.messages.slice(idx + 1);
  }

  shouldSummarize(threshold: number): boolean {
    if (this.summarizedUntilId && !this.summary) return true;
    return this.effectiveMessages.length >= threshold;
  }

  setSummary(summary: string, untilMessageId: string): void {
    this.summary = summary;
    this.summarizedUntilId = untilMessageId;
    this.updatedAt = new Date();
  }

  addUser(idUser: string): void {
    if (this.idUser) {
      throw new ValidationException("There already is a user ID for this chat");
    }
    this.idUser = idUser;
    this.updatedAt = new Date();
  }

  deleteChat(): void {
    if (this.isDeleted) {
      throw new ValidationException("The chat is already deleted");
    }
    this.isDeleted = true;
    this.updatedAt = new Date();
  }

  addUserTextMessage(text: string, idProvider?: string): Message {
    const message = new Message({
      idChat: this.id,
      idProvider,
      type: MessageType.Text,
      userType: MessageUserType.User,
      text,
    });
    this.messages.push(message);
    return message;
  }

  addBotTextMessage(text: string, idProvider?: string): Message {
    const message = new Message({
      idChat: this.id,
      idProvider,
      type: MessageType.Text,
      userType: MessageUserType.Bot,
      text,
    });
    this.messages.push(message);
    return message;
  }

  addUserButtonReply(reply: string, idProvider?: string): Message {
    const message = new Message({
      idChat: this.id,
      idProvider,
      type: MessageType.ButtonReply,
      userType: MessageUserType.User,
      buttonReply: reply,
    });
    this.messages.push(message);
    return message;
  }

  addBotButtonReply(
    replyText: string,
    buttons: string[],
    idProvider?: string,
  ): Message {
    const message = new Message({
      idChat: this.id,
      idProvider,
      type: MessageType.ButtonReply,
      userType: MessageUserType.Bot,
      text: replyText,
      buttonReplyOptions: buttons,
    });
    this.messages.push(message);
    return message;
  }

  addUserAudioMessage(
    mediaId: string,
    mimeType: string,
    idProvider?: string,
  ): Message {
    const message = new Message({
      idChat: this.id,
      idProvider,
      type: MessageType.Audio,
      userType: MessageUserType.User,
      mediaId,
      mimeType,
    });
    this.messages.push(message);
    return message;
  }

  toJSON() {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      type: this.type.toLowerCase(),
      messages: this.messages.map((m) => m.toJSON()),
      summary: this.summary,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isDeleted: this.isDeleted,
    };
  }
}
