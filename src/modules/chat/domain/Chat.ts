import { v4 as uuidv4 } from "uuid";
import type { ConversationSummary } from "~/modules/chat/domain/ConversationSummary";
import { ChatChannel } from "~/modules/chat/domain/enums/ChatChannel";
import { MessageAudience } from "~/modules/chat/domain/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/domain/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/domain/enums/MessageRole";
import {
  Message,
  type MessageConfig,
  type ToolCallContent,
  type ToolResultContent,
} from "~/modules/chat/domain/Message";
import { ValidationException } from "~/shared/errors/DomainErrors";

export interface AssistantMessageOptions {
  turnId?: string;
  audience?: MessageAudience;
  channelMessageId?: string;
}

export class Chat {
  id: string;
  idUser?: string;
  whatsAppAddress?: string;
  webAddress?: string;
  channel: ChatChannel;
  messages: Message[];
  summary?: ConversationSummary;
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
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDeleted = false;
  }

  static restore(config: {
    id: string;
    idUser?: string;
    whatsAppAddress?: string;
    webAddress?: string;
    channel: ChatChannel;
    messages: Message[];
    summary?: ConversationSummary;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
  }): Chat {
    const chat = new Chat();
    chat.id = config.id;
    chat.idUser = config.idUser;
    chat.whatsAppAddress = config.whatsAppAddress;
    chat.webAddress = config.webAddress;
    chat.channel = config.channel;
    chat.messages = config.messages;
    chat.summary = config.summary;
    chat.createdAt = config.createdAt;
    chat.updatedAt = config.updatedAt;
    chat.isDeleted = config.isDeleted;
    return chat;
  }

  getChannelMessages(): Message[] {
    return this.messages.filter((m) => m.isChannelVisible);
  }

  getModelMessages(): Message[] {
    const cursor = this.summary?.compactedThroughSequence;
    return this.messages.filter((m) => {
      if (!m.isModelVisible) return false;
      if (cursor === undefined) return true;
      return m.sequence === undefined || m.sequence > cursor;
    });
  }

  getUncompactedTurns(): Message[][] {
    const turns = new Map<string, Message[]>();
    for (const message of this.getModelMessages()) {
      const turn = turns.get(message.turnId);
      if (turn) {
        turn.push(message);
      } else {
        turns.set(message.turnId, [message]);
      }
    }
    return [...turns.values()];
  }

  static isTurnComplete(turn: Message[]): boolean {
    const messages = turn.filter((message) => message.isModelVisible);
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role !== MessageRole.Assistant ||
      (lastMessage.content.type !== MessageContentType.Text &&
        lastMessage.content.type !== MessageContentType.Button)
    ) {
      return false;
    }
    return messages.every((message, index) => {
      if (message.content.type !== MessageContentType.ToolCall) return true;
      const callId = message.content.callId;
      return messages
        .slice(index + 1)
        .some(
          (candidate) =>
            candidate.content.type === MessageContentType.ToolResult &&
            candidate.content.callId === callId,
        );
    });
  }

  getToolCall(turnId: string, callId: string): Message | undefined {
    return this.messages.find(
      (message) =>
        message.turnId === turnId &&
        message.content.type === MessageContentType.ToolCall &&
        message.content.callId === callId,
    );
  }

  getToolResult(turnId: string, callId: string): Message | undefined {
    return this.messages.find(
      (m) =>
        m.turnId === turnId &&
        m.content.type === MessageContentType.ToolResult &&
        m.content.callId === callId,
    );
  }

  setSummary(summary: ConversationSummary): void {
    const cursor = summary.compactedThroughSequence;
    if (this.summary && cursor <= this.summary.compactedThroughSequence) {
      throw new ValidationException(
        "The summary cursor must advance past the current summary",
      );
    }
    const cursorMessage = this.messages.find((m) => m.sequence === cursor);
    if (!cursorMessage) {
      throw new ValidationException(
        "The summary cursor must reference a message in this chat",
      );
    }
    const turn = this.messages.filter((m) => m.turnId === cursorMessage.turnId);
    const lastOfTurn = turn[turn.length - 1];
    if (lastOfTurn?.id !== cursorMessage.id || !Chat.isTurnComplete(turn)) {
      throw new ValidationException(
        "The summary cursor must end a complete conversation turn",
      );
    }
    this.summary = summary;
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
    return this.appendMessage({
      channelMessageId,
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Text, text },
    });
  }

  addUserButtonMessage(reply: string, channelMessageId?: string): Message {
    return this.appendMessage({
      channelMessageId,
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Button, text: reply },
    });
  }

  addUserAudioMessage(
    mediaId: string,
    mimeType: string,
    channelMessageId?: string,
  ): Message {
    return this.appendMessage({
      channelMessageId,
      role: MessageRole.User,
      audience: MessageAudience.Both,
      content: { type: MessageContentType.Audio, mediaId, mimeType },
    });
  }

  addAssistantTextMessage(
    text: string,
    options?: AssistantMessageOptions,
  ): Message {
    return this.appendMessage({
      turnId: options?.turnId,
      channelMessageId: options?.channelMessageId,
      role: MessageRole.Assistant,
      audience: options?.audience ?? MessageAudience.Both,
      content: { type: MessageContentType.Text, text },
    });
  }

  addAssistantButtonMessage(
    text: string,
    buttons: string[],
    options?: AssistantMessageOptions,
  ): Message {
    return this.appendMessage({
      turnId: options?.turnId,
      channelMessageId: options?.channelMessageId,
      role: MessageRole.Assistant,
      audience: options?.audience ?? MessageAudience.Both,
      content: { type: MessageContentType.Button, text, options: buttons },
    });
  }

  addAssistantToolCall(turnId: string, call: ToolCallContent): Message {
    if (!this.messages.some((m) => m.turnId === turnId)) {
      throw new ValidationException(
        "Tool calls must belong to an existing conversation turn",
      );
    }
    return this.appendMessage({
      turnId,
      role: MessageRole.Assistant,
      audience: MessageAudience.Model,
      content: call,
    });
  }

  addToolResult(turnId: string, result: ToolResultContent): Message {
    const hasMatchingCall = this.messages.some(
      (m) =>
        m.turnId === turnId &&
        m.content.type === MessageContentType.ToolCall &&
        m.content.callId === result.callId,
    );
    if (!hasMatchingCall) {
      throw new ValidationException(
        "Tool results must reference an earlier tool call in the same turn",
      );
    }
    if (this.getToolResult(turnId, result.callId)) {
      throw new ValidationException(
        "This tool call already has a persisted result",
      );
    }
    return this.appendMessage({
      turnId,
      role: MessageRole.Tool,
      audience: MessageAudience.Model,
      content: result,
    });
  }

  private appendMessage(config: Omit<MessageConfig, "idChat">): Message {
    const message = new Message({ ...config, idChat: this.id });
    this.messages.push(message);
    return message;
  }

  toJSON() {
    return {
      id: this.id,
      whatsAppAddress: this.whatsAppAddress,
      webAddress: this.webAddress,
      channel: this.channel.toLowerCase(),
      messages: this.getChannelMessages().map((m) => m.toJSON()),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isDeleted: this.isDeleted,
    };
  }
}
