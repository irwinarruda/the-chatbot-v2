import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/infra/exceptions";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";
import { Message } from "~/shared/entities/Message";

export class Chat {
  id: string;
  idUser?: string;
  whatsAppAddress?: string;
  webAddress?: string;
  channel: ChatChannel;
  messages: Message[];
  summary?: string;
  summarizedUntilId?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;

  constructor() {
    this.id = uuidv4();
    this.idUser = undefined;
    this.whatsAppAddress = undefined;
    this.webAddress = undefined;
    this.channel = ChatChannel.WhatsApp;
    this.messages = [];
    this.summary = undefined;
    this.summarizedUntilId = undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDeleted = false;
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

  setChannelAddress(channel: ChatChannel, channelAddress: string): void {
    if (!channelAddress) {
      throw new ValidationException("Channel address is required");
    }
    this.channel = channel;
    if (channel === ChatChannel.WhatsApp) {
      this.whatsAppAddress = channelAddress;
    } else if (channel === ChatChannel.Web) {
      this.webAddress = channelAddress.toLowerCase();
    } else {
      throw new ValidationException("Unsupported chat channel");
    }
    this.updatedAt = new Date();
  }

  getChannelAddress(): string {
    if (this.channel === ChatChannel.WhatsApp && this.whatsAppAddress) {
      return this.whatsAppAddress;
    }
    if (this.channel === ChatChannel.Web && this.webAddress) {
      return this.webAddress;
    }
    throw new ValidationException("Chat channel address is required");
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

  addUserTextMessage(text: string, channelMessageId?: string): Message {
    const message = new Message({
      idChat: this.id,
      channelMessageId,
      type: MessageType.Text,
      userType: MessageUserType.User,
      text,
    });
    this.messages.push(message);
    return message;
  }

  addBotTextMessage(text: string, channelMessageId?: string): Message {
    const message = new Message({
      idChat: this.id,
      channelMessageId,
      type: MessageType.Text,
      userType: MessageUserType.Bot,
      text,
    });
    this.messages.push(message);
    return message;
  }

  addUserButtonReply(reply: string, channelMessageId?: string): Message {
    const message = new Message({
      idChat: this.id,
      channelMessageId,
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
    channelMessageId?: string,
  ): Message {
    const message = new Message({
      idChat: this.id,
      channelMessageId,
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
    channelMessageId?: string,
  ): Message {
    const message = new Message({
      idChat: this.id,
      channelMessageId,
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
      whatsAppAddress: this.whatsAppAddress,
      webAddress: this.webAddress,
      channel: this.channel.toLowerCase(),
      messages: this.messages.map((m) => m.toJSON()),
      summary: this.summary,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isDeleted: this.isDeleted,
    };
  }
}
