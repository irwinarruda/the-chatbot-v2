import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/infra/exceptions";
import { MessageAudience } from "~/shared/entities/enums/MessageAudience";
import { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import { MessageRole } from "~/shared/entities/enums/MessageRole";
import { ToolResultStatus } from "~/shared/entities/enums/ToolResultStatus";

export type ToolResultOutcome =
  | { status: typeof ToolResultStatus.Succeeded; data: unknown }
  | { status: typeof ToolResultStatus.Failed; code: string; message: string }
  | { status: typeof ToolResultStatus.Unknown; code: string; message: string };

export type MessageContent =
  | { type: typeof MessageContentType.Text; text: string }
  | {
      type: typeof MessageContentType.Button;
      text: string;
      options?: string[];
    }
  | {
      type: typeof MessageContentType.Audio;
      mediaId?: string;
      mediaUrl?: string;
      mimeType: string;
      transcript?: string;
    }
  | {
      type: typeof MessageContentType.ToolCall;
      callId: string;
      name: string;
      arguments: unknown;
    }
  | {
      type: typeof MessageContentType.ToolResult;
      callId: string;
      outcome: ToolResultOutcome;
    };

export type ToolCallContent = Extract<
  MessageContent,
  { type: typeof MessageContentType.ToolCall }
>;
export type ToolResultContent = Extract<
  MessageContent,
  { type: typeof MessageContentType.ToolResult }
>;

export interface MessageConfig {
  idChat: string;
  role: MessageRole;
  audience: MessageAudience;
  content: MessageContent;
  turnId?: string;
  channelMessageId?: string;
}

export interface RestoredMessageConfig {
  id: string;
  idChat: string;
  turnId: string;
  sequence: number;
  role: unknown;
  audience: unknown;
  content: unknown;
  channelMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Message {
  id: string;
  idChat: string;
  turnId: string;
  sequence?: number;
  role: MessageRole;
  audience: MessageAudience;
  content: MessageContent;
  channelMessageId?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(config: MessageConfig) {
    this.id = uuidv4();
    this.idChat = config.idChat;
    this.turnId = config.turnId ?? this.id;
    this.sequence = undefined;
    this.role = config.role;
    this.audience = config.audience;
    this.content = config.content;
    this.channelMessageId = config.channelMessageId;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.validate();
  }

  static restore(config: RestoredMessageConfig): Message {
    const message = new Message({
      idChat: config.idChat,
      turnId: config.turnId,
      role: config.role as MessageRole,
      audience: config.audience as MessageAudience,
      content: config.content as MessageContent,
      channelMessageId: config.channelMessageId,
    });
    message.id = config.id;
    message.sequence = config.sequence;
    message.createdAt = config.createdAt;
    message.updatedAt = config.updatedAt;
    message.validate();
    return message;
  }

  private validate(): void {
    if (!this.id || !this.idChat || !this.turnId) {
      throw new ValidationException(
        "Messages require an ID, chat ID, and turn ID",
      );
    }
    if (
      !Number.isSafeInteger(this.sequence ?? 1) ||
      (this.sequence ?? 1) <= 0
    ) {
      throw new ValidationException("Message sequence is invalid");
    }
    if (!Object.values(MessageRole).includes(this.role)) {
      throw new ValidationException("Message role is invalid");
    }
    if (!Object.values(MessageAudience).includes(this.audience)) {
      throw new ValidationException("Message audience is invalid");
    }
    if (
      Number.isNaN(this.createdAt.getTime()) ||
      Number.isNaN(this.updatedAt.getTime())
    ) {
      throw new ValidationException("Message timestamps are invalid");
    }
    const { role, audience, content } = this;
    if (!content || typeof content !== "object" || !("type" in content)) {
      throw new ValidationException("Message content is invalid");
    }
    if (!Object.values(MessageContentType).includes(content.type)) {
      throw new ValidationException("Message content type is invalid");
    }
    if (
      content.type === MessageContentType.ToolCall &&
      role !== MessageRole.Assistant
    ) {
      throw new ValidationException("Tool calls must use the Assistant role");
    }
    if (
      content.type === MessageContentType.ToolResult &&
      role !== MessageRole.Tool
    ) {
      throw new ValidationException("Tool results must use the Tool role");
    }
    if (
      role === MessageRole.Tool &&
      content.type !== MessageContentType.ToolResult
    ) {
      throw new ValidationException(
        "The Tool role only carries tool result content",
      );
    }
    if (
      (content.type === MessageContentType.ToolCall ||
        content.type === MessageContentType.ToolResult) &&
      audience !== MessageAudience.Model
    ) {
      throw new ValidationException(
        "Tool calls and results must be model-only messages",
      );
    }
    if (
      content.type === MessageContentType.ToolCall &&
      (!content.callId || !content.name)
    ) {
      throw new ValidationException("Tool calls require a call ID and name");
    }
    if (content.type === MessageContentType.ToolResult) {
      if (!content.callId) {
        throw new ValidationException("Tool results require a call ID");
      }
      const outcome = content.outcome as {
        status?: string;
        code?: unknown;
        message?: unknown;
      };
      if (!Object.values(ToolResultStatus).includes(outcome.status as never)) {
        throw new ValidationException("Tool result status is invalid");
      }
      if (
        outcome.status === ToolResultStatus.Succeeded &&
        (outcome.code !== undefined || outcome.message !== undefined)
      ) {
        throw new ValidationException(
          "A successful tool result cannot carry an error payload",
        );
      }
      if (
        (outcome.status === ToolResultStatus.Failed ||
          outcome.status === ToolResultStatus.Unknown) &&
        (typeof outcome.code !== "string" ||
          typeof outcome.message !== "string")
      ) {
        throw new ValidationException(
          "Failed and unknown tool results require a code and message",
        );
      }
    }
    if (
      content.type === MessageContentType.Audio &&
      (typeof content.mimeType !== "string" || !content.mimeType)
    ) {
      throw new ValidationException("Audio messages require a mime type");
    }
    if (
      content.type === MessageContentType.Text &&
      typeof content.text !== "string"
    ) {
      throw new ValidationException("Text messages require text content");
    }
    if (
      content.type === MessageContentType.Button &&
      typeof content.text !== "string"
    ) {
      throw new ValidationException("Button messages require text content");
    }
    if (
      content.type === MessageContentType.Button &&
      content.options !== undefined &&
      (!Array.isArray(content.options) ||
        content.options.some((option) => typeof option !== "string"))
    ) {
      throw new ValidationException("Button options must be strings");
    }
  }

  get isChannelVisible(): boolean {
    return this.audience !== MessageAudience.Model;
  }

  get isModelVisible(): boolean {
    return this.audience !== MessageAudience.Channel;
  }

  get text(): string | undefined {
    if (this.content.type === MessageContentType.Text) {
      return this.content.text;
    }
    if (
      this.content.type === MessageContentType.Button &&
      this.role === MessageRole.Assistant
    ) {
      return this.content.text;
    }
    return undefined;
  }

  get buttonReply(): string | undefined {
    if (
      this.content.type === MessageContentType.Button &&
      this.role === MessageRole.User
    ) {
      return this.content.text;
    }
    return undefined;
  }

  get buttonReplyOptions(): string[] | undefined {
    return this.content.type === MessageContentType.Button
      ? this.content.options
      : undefined;
  }

  get mediaId(): string | undefined {
    return this.content.type === MessageContentType.Audio
      ? this.content.mediaId
      : undefined;
  }

  get mediaUrl(): string | undefined {
    return this.content.type === MessageContentType.Audio
      ? this.content.mediaUrl
      : undefined;
  }

  get mimeType(): string | undefined {
    return this.content.type === MessageContentType.Audio
      ? this.content.mimeType
      : undefined;
  }

  get transcript(): string | undefined {
    return this.content.type === MessageContentType.Audio
      ? this.content.transcript
      : undefined;
  }

  addAudioTranscriptAndUrl(transcript: string, url: string): void {
    if (this.content.type !== MessageContentType.Audio) {
      throw new ValidationException(
        "Only audio messages can receive a transcript",
      );
    }
    this.content = { ...this.content, transcript, mediaUrl: url };
    this.updatedAt = new Date();
  }

  toJSON() {
    if (
      this.content.type === MessageContentType.ToolCall ||
      this.content.type === MessageContentType.ToolResult
    ) {
      throw new ValidationException(
        "Tool messages cannot be serialized to channel clients",
      );
    }
    return {
      id: this.id,
      type:
        this.content.type === MessageContentType.Button
          ? "interactive"
          : this.content.type,
      userType: this.role === MessageRole.Assistant ? "bot" : "user",
      text: this.text,
      buttonReply: this.buttonReply,
      buttonReplyOptions: this.buttonReplyOptions,
      mediaUrl: this.mediaUrl,
      mimeType: this.mimeType,
      transcript: this.transcript,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
