import { v4 as uuidv4 } from "uuid";
import type { SummarizationConfig } from "~/infra/config";
import type { Database } from "~/infra/database";
import { UnauthorizedException, ValidationException } from "~/infra/exceptions";
import type { IMediator } from "~/infra/mediator";
import type {
  AiChatMessage,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import {
  AiChatMessageType,
  AiChatRole,
} from "~/server/resources/IAiChatGateway";
import type {
  IMessagingGateway,
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
} from "~/server/resources/IMessagingGateway";
import type { ISpeechToTextGateway } from "~/server/resources/ISpeechToTextGateway";
import type { IStorageGateway } from "~/server/resources/IStorageGateway";
import type {
  IWebMessagingGateway,
  WebChatEvent,
} from "~/server/resources/IWebMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/server/resources/IWhatsAppMessagingGateway";
import type { AuthService } from "~/server/services/AuthService";
import { MessageLoader, MessageTemplate } from "~/server/utils/MessageLoader";
import { AllowedNumber } from "~/shared/entities/AllowedNumber";
import { Chat } from "~/shared/entities/Chat";
import { ChatType } from "~/shared/entities/enums/ChatType";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";
import { Message } from "~/shared/entities/Message";

export interface TranscriptDTO {
  id: string;
  transcript: string;
  mediaUrl?: string;
  mimeType?: string;
  createdAt: Date;
}

export interface RespondToMessageEvent {
  chat: Chat;
  message: Message;
  chatType: ChatType;
}

export class MessagingService {
  private database: Database;
  private authService: AuthService;
  private mediator: IMediator;
  private whatsAppMessagingGateway: IWhatsAppMessagingGateway;
  private webMessagingGateway: IWebMessagingGateway;
  private aiChatGateway: IAiChatGateway;
  private storageGateway: IStorageGateway;
  private speechToTextGateway: ISpeechToTextGateway;
  private summarizationConfig: SummarizationConfig;

  constructor(
    database: Database,
    authService: AuthService,
    mediator: IMediator,
    whatsAppMessagingGateway: IWhatsAppMessagingGateway,
    webMessagingGateway: IWebMessagingGateway,
    aiChatGateway: IAiChatGateway,
    storageGateway: IStorageGateway,
    speechToTextGateway: ISpeechToTextGateway,
    summarizationConfig: SummarizationConfig,
  ) {
    this.database = database;
    this.authService = authService;
    this.mediator = mediator;
    this.whatsAppMessagingGateway = whatsAppMessagingGateway;
    this.webMessagingGateway = webMessagingGateway;
    this.aiChatGateway = aiChatGateway;
    this.storageGateway = storageGateway;
    this.speechToTextGateway = speechToTextGateway;
    this.summarizationConfig = summarizationConfig;
  }

  private getMessagingGatewayByChatType(chatType: ChatType): IMessagingGateway {
    switch (chatType) {
      case ChatType.WhatsApp:
        return this.whatsAppMessagingGateway;
      case ChatType.Web:
        return this.webMessagingGateway;
      default:
        throw new ValidationException("Unsupported chat type");
    }
  }

  async receiveWhatsAppMessage(
    rawBody: string,
    signature?: string,
  ): Promise<void> {
    if (
      !signature ||
      !this.whatsAppMessagingGateway.validateSignature(signature, rawBody)
    ) {
      throw new UnauthorizedException(
        "Invalid Signature",
        "Please check your request signature.",
      );
    }
    const data = JSON.parse(rawBody);
    const receiveMessage =
      this.whatsAppMessagingGateway.receiveWhatsAppMessage(data);
    if (receiveMessage) {
      await this.listenToMessage(receiveMessage);
    }
  }

  async receiveWebMessage(phoneNumber: string, body: unknown): Promise<void> {
    const receiveMessage = await this.webMessagingGateway.receiveWebMessage(
      phoneNumber,
      body,
    );
    if (receiveMessage) {
      await this.listenToMessage(receiveMessage);
    }
  }

  async listenToMessage(receiveMessage: ReceiveMessageDTO): Promise<void> {
    if (await this.isMessageDuplicate(receiveMessage.idProvider)) return;
    if (!(await this.isAllowedNumber(receiveMessage.from))) return;
    let chat = await this.getChatByPhoneNumber(receiveMessage.from);
    if (!chat) {
      chat = new Chat();
      chat.phoneNumber = receiveMessage.from;
      chat.type = receiveMessage.chatType;
      await this.createChat(chat);
    }
    let message: Message;
    if ("text" in receiveMessage) {
      message = chat.addUserTextMessage(
        (receiveMessage as ReceiveTextMessageDTO).text,
        receiveMessage.idProvider,
      );
    } else if ("buttonReply" in receiveMessage) {
      message = chat.addUserButtonReply(
        (receiveMessage as ReceiveInteractiveButtonMessageDTO).buttonReply,
        receiveMessage.idProvider,
      );
    } else if ("mediaId" in receiveMessage) {
      const audioMsg = receiveMessage as ReceiveAudioMessageDTO;
      message = chat.addUserAudioMessage(
        audioMsg.mediaId,
        audioMsg.mimeType,
        receiveMessage.idProvider,
      );
    } else {
      message = chat.addUserTextMessage("", "");
    }
    if (!(await this.createMessage(message))) return;
    if (!chat.idUser) {
      const user = await this.authService.getUserByPhoneNumber(
        chat.phoneNumber,
      );
      if (!user) {
        await this.sendTextMessage(
          chat.phoneNumber,
          MessageLoader.getMessage(MessageTemplate.ThankYou, {
            loginUrl: this.authService.getAppLoginUrl(chat.phoneNumber),
          }),
        );
        return;
      }
      chat.addUser(user.id);
      await this.saveChat(chat);
    }
    await this.mediator.send("RespondToMessage", {
      chat,
      message,
      chatType: receiveMessage.chatType,
    } as RespondToMessageEvent);
  }

  async respondToMessage(
    chat: Chat,
    message: Message,
    chatType: ChatType,
  ): Promise<void> {
    const gateway = this.getMessagingGatewayByChatType(chatType);
    if (message.type === MessageType.Audio) {
      if (!message.mediaId || !message.mimeType) return;
      await this.sendTextMessage(
        chat.phoneNumber,
        MessageLoader.getMessage(MessageTemplate.ProcessingAudio),
        chat,
        chatType,
      );
      const mediaContent = await gateway.downloadMediaAsync(message.mediaId);
      const baseMimeType = message.mimeType.split(";")[0].trim().toLowerCase();
      const key = `audio/${chat.id}/${uuidv4()}${this.getExtension(baseMimeType)}`;
      const permanentUrl = await this.storageGateway.uploadFileAsync({
        key,
        content: mediaContent,
        contentType: baseMimeType,
      });
      const transcript = await this.speechToTextGateway.transcribeAsync({
        audioStream: mediaContent,
        mimeType: baseMimeType,
      });
      message.addAudioTranscriptAndUrl(transcript, permanentUrl);
      await this.saveMessage(message);
      if (chatType === ChatType.Web) {
        this.webMessagingGateway.enqueue(chat.phoneNumber, {
          type: "audio",
          data: {
            mediaUrl: permanentUrl,
            mimeType: baseMimeType,
            transcript,
          },
        });
      }
    }
    const aiMessages: AiChatMessage[] = [];
    if (chat.summary) {
      aiMessages.push({
        role: AiChatRole.System,
        type: AiChatMessageType.Text,
        text: chat.summary,
      });
    }
    aiMessages.push(...this.parseMessagesToAi(chat.effectiveMessages));
    const response = await this.aiChatGateway.getResponse(
      chat.phoneNumber,
      aiMessages,
    );
    if (response.type === AiChatMessageType.Text) {
      await this.sendTextMessage(
        chat.phoneNumber,
        response.text,
        chat,
        chatType,
      );
    } else if (response.type === AiChatMessageType.Button) {
      await this.sendButtonReplyMessage(
        chat.phoneNumber,
        response.text,
        [...response.buttons],
        chat,
        chatType,
      );
    }
    await this.triggerSummarization(chat);
  }

  async sendTextMessage(
    phoneNumber: string,
    text: string,
    chat?: Chat,
    chatType?: ChatType,
  ): Promise<void> {
    chat ??= await this.getChatByPhoneNumber(phoneNumber);
    if (!chat) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    const gateway = this.getMessagingGatewayByChatType(chatType ?? chat.type);
    const message = chat.addBotTextMessage(text);
    await this.createMessage(message);
    await gateway.sendTextMessage({
      to: phoneNumber,
      text,
    });
  }

  async sendButtonReplyMessage(
    phoneNumber: string,
    text: string,
    options: string[],
    chat?: Chat,
    chatType?: ChatType,
  ): Promise<void> {
    chat ??= await this.getChatByPhoneNumber(phoneNumber);
    if (!chat) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    const gateway = this.getMessagingGatewayByChatType(chatType ?? chat.type);
    const message = chat.addBotButtonReply(text, options);
    await this.createMessage(message);
    await gateway.sendInteractiveReplyButtonMessage({
      to: chat.phoneNumber,
      text,
      buttons: options,
    });
  }

  async sendSignedInMessage(phoneNumber: string): Promise<void> {
    await this.sendTextMessage(
      phoneNumber,
      MessageLoader.getMessage(MessageTemplate.SignedIn),
    );
  }

  async subscribeToWebEvents(
    phoneNumber: string,
    signal: AbortSignal,
  ): Promise<AsyncGenerator<WebChatEvent>> {
    return this.webMessagingGateway.subscribe(phoneNumber, signal);
  }

  private async triggerSummarization(chat: Chat): Promise<void> {
    try {
      if (!chat.shouldSummarize(this.summarizationConfig.messageCountThreshold))
        return;
      const messagesToSummarize = this.parseMessagesToAi(
        chat.effectiveMessages,
      );
      const lastMessage =
        chat.effectiveMessages[chat.effectiveMessages.length - 1];
      if (!lastMessage) return;
      const lastMessageId = lastMessage.id;
      const summary = await this.aiChatGateway.generateSummary(
        messagesToSummarize,
        chat.summary,
      );
      chat.setSummary(summary, lastMessageId);
      await this.saveChat(chat);
    } catch {}
  }

  async deleteChat(phoneNumber: string): Promise<void> {
    const chat = await this.getChatByPhoneNumber(phoneNumber);
    if (!chat) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    chat.deleteChat();
    await this.saveChat(chat);
  }

  async addAllowedNumber(phoneNumber: string): Promise<void> {
    const allowedNumber = new AllowedNumber(phoneNumber);
    await this.database.sql`
      INSERT INTO allowed_numbers (id, phone_number, created_at)
      VALUES (${allowedNumber.id}, ${allowedNumber.phoneNumber}, ${allowedNumber.createdAt})
    `;
  }

  validateWebhook(hubMode: string, hubVerifyToken: string): void {
    if (
      !this.whatsAppMessagingGateway.validateWebhook(hubMode, hubVerifyToken)
    ) {
      throw new ValidationException("The provided token did not match");
    }
  }

  async getTranscripts(phoneNumber: string): Promise<TranscriptDTO[]> {
    const dbMessages = await this.database.sql<DbMessage[]>`
      SELECT m.* FROM messages m
      INNER JOIN chats c ON c.id = m.id_chat
      WHERE c.phone_number = ${phoneNumber}
      AND c.is_deleted = false
      AND m.type = ${MessageType.Audio}
      AND m.transcript IS NOT NULL
      ORDER BY m.created_at DESC
    `;
    return dbMessages.map((m) => ({
      id: m.id,
      transcript: m.transcript ?? "",
      mediaUrl: m.media_url ?? undefined,
      mimeType: m.mime_type ?? undefined,
      createdAt: m.created_at,
    }));
  }

  async getChatByPhoneNumber(phoneNumber: string): Promise<Chat | undefined> {
    const dbChats = await this.database.sql<DbChat[]>`
      SELECT * FROM chats
      WHERE phone_number = ${phoneNumber}
      AND is_deleted = false
      ORDER BY created_at DESC
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    const dbMessages = await this.database.sql<DbMessage[]>`
      SELECT * FROM messages
      WHERE id_chat = ${dbChat.id}
      ORDER BY created_at ASC
    `;
    const chat = new Chat();
    chat.id = dbChat.id;
    chat.idUser = dbChat.id_user ?? undefined;
    chat.type = dbChat.type as ChatType;
    chat.phoneNumber = dbChat.phone_number;
    chat.summary = dbChat.summary ?? undefined;
    chat.summarizedUntilId = dbChat.summarized_until_id ?? undefined;
    chat.messages = dbMessages.map((m) => {
      const message = new Message();
      message.id = m.id;
      message.idChat = m.id_chat;
      message.text = m.text ?? undefined;
      message.type = m.type as MessageType;
      message.buttonReply = m.button_reply ?? undefined;
      message.buttonReplyOptions =
        typeof m.button_reply_options === "string"
          ? m.button_reply_options.split(",")
          : undefined;
      message.mediaId = m.media_id ?? undefined;
      message.mediaUrl = m.media_url ?? undefined;
      message.mimeType = m.mime_type ?? undefined;
      message.transcript = m.transcript ?? undefined;
      message.userType = m.user_type as MessageUserType;
      message.idProvider = m.id_provider ?? undefined;
      message.createdAt = m.created_at;
      message.updatedAt = m.updated_at;
      return message;
    });
    chat.createdAt = dbChat.created_at;
    chat.updatedAt = dbChat.updated_at;
    chat.isDeleted = dbChat.is_deleted;
    return chat;
  }

  private async createChat(chat: Chat): Promise<void> {
    const idUser = chat.idUser ?? null;
    await this.database.sql`
      INSERT INTO chats (id, id_user, type, phone_number, created_at, updated_at, is_deleted)
      VALUES (${chat.id}, ${idUser}, ${chat.type}, ${chat.phoneNumber}, ${chat.createdAt}, ${chat.updatedAt}, ${chat.isDeleted})
    `;
    if (chat.messages.length === 0) return;
    for (const message of chat.messages) {
      await this.createMessage(message);
    }
  }

  private async createMessage(message: Message): Promise<boolean> {
    const buttonOptions = message.buttonReplyOptions
      ? message.buttonReplyOptions.join(",")
      : undefined;
    const text = message.text ?? null;
    const buttonReply = message.buttonReply ?? null;
    const serializedButtonOptions = buttonOptions ?? null;
    const mediaId = message.mediaId ?? null;
    const mediaUrl = message.mediaUrl ?? null;
    const mimeType = message.mimeType ?? null;
    const transcript = message.transcript ?? null;
    const idProvider = message.idProvider ?? null;
    const result = await this.database.sql`
      INSERT INTO messages (id, id_chat, type, user_type, text, button_reply, button_reply_options, media_id, media_url, mime_type, transcript, id_provider, created_at, updated_at)
      VALUES (${message.id}, ${message.idChat}, ${message.type}, ${message.userType}, ${text}, ${buttonReply}, ${serializedButtonOptions}, ${mediaId}, ${mediaUrl}, ${mimeType}, ${transcript}, ${idProvider}, ${message.createdAt}, ${message.updatedAt})
      ON CONFLICT (id_provider) WHERE id_provider IS NOT NULL DO NOTHING
    `;
    return result.count > 0;
  }

  private async saveMessage(message: Message): Promise<void> {
    const buttonOptions = message.buttonReplyOptions
      ? message.buttonReplyOptions.join(",")
      : undefined;
    const text = message.text ?? null;
    const buttonReply = message.buttonReply ?? null;
    const serializedButtonOptions = buttonOptions ?? null;
    const mediaId = message.mediaId ?? null;
    const mediaUrl = message.mediaUrl ?? null;
    const mimeType = message.mimeType ?? null;
    const transcript = message.transcript ?? null;
    await this.database.sql`
      UPDATE messages SET
        text = ${text},
        button_reply = ${buttonReply},
        button_reply_options = ${serializedButtonOptions},
        media_id = ${mediaId},
        media_url = ${mediaUrl},
        mime_type = ${mimeType},
        transcript = ${transcript},
        updated_at = ${message.updatedAt}
      WHERE id = ${message.id}
    `;
  }

  private async saveChat(chat: Chat): Promise<void> {
    const idUser = chat.idUser ?? null;
    const summary = chat.summary ?? null;
    const summarizedUntilId = chat.summarizedUntilId ?? null;
    await this.database.sql`
      UPDATE chats SET
        id_user = ${idUser},
        type = ${chat.type},
        phone_number = ${chat.phoneNumber},
        updated_at = ${chat.updatedAt},
        summary = ${summary},
        summarized_until_id = ${summarizedUntilId},
        is_deleted = ${chat.isDeleted}
      WHERE id = ${chat.id}
    `;
  }

  private async isMessageDuplicate(idProvider: string): Promise<boolean> {
    const result = await this.database.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE id_provider = ${idProvider}
      )
    `;
    return result[0]?.exists ?? false;
  }

  private async isAllowedNumber(phoneNumber: string): Promise<boolean> {
    const result = await this.database.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM allowed_numbers
        WHERE phone_number = ${phoneNumber}
      )
    `;
    return result[0]?.exists ?? false;
  }

  private parseMessagesToAi(messages: Message[]): AiChatMessage[] {
    return messages.map((m) => ({
      role:
        m.userType === MessageUserType.Bot
          ? AiChatRole.Assistant
          : AiChatRole.User,
      type:
        m.type === MessageType.ButtonReply
          ? AiChatMessageType.Button
          : AiChatMessageType.Text,
      text: m.buttonReply ?? m.transcript ?? m.text ?? "",
      buttons: m.buttonReplyOptions ?? [],
    }));
  }

  private getExtension(mimeType: string): string {
    const baseType = mimeType.split(";")[0].trim().toLowerCase();
    switch (baseType) {
      case "audio/ogg":
        return ".ogg";
      case "audio/mpeg":
      case "audio/mp3":
        return ".mp3";
      case "audio/mp4":
      case "audio/m4a":
      case "audio/x-m4a":
        return ".m4a";
      case "audio/aac":
        return ".aac";
      case "audio/amr":
        return ".amr";
      case "audio/webm":
        return ".webm";
      case "audio/wav":
      case "audio/wave":
      case "audio/x-wav":
        return ".wav";
      default:
        return ".bin";
    }
  }
}

interface DbChat {
  id: string;
  id_user: string | null;
  type: string;
  phone_number: string;
  summary: string | null;
  summarized_until_id: string | null;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
}

interface DbMessage {
  id: string;
  id_chat: string;
  user_type: string;
  type: string;
  text: string | null;
  button_reply: string | null;
  button_reply_options: string | null;
  media_id: string | null;
  media_url: string | null;
  mime_type: string | null;
  transcript: string | null;
  id_provider: string | null;
  created_at: Date;
  updated_at: Date;
}
