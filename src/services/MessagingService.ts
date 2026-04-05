import { v4 as uuidv4 } from "uuid";
import { AllowedNumber } from "~/entities/AllowedNumber";
import { Chat, type ChatType } from "~/entities/Chat";
import { Message, MessageType, MessageUserType } from "~/entities/Message";
import type { SummarizationConfig } from "~/infra/config";
import type { Database } from "~/infra/database";
import { UnauthorizedException, ValidationException } from "~/infra/exceptions";
import type { AiChatMessage, IAiChatGateway } from "~/resources/IAiChatGateway";
import { AiChatMessageType, AiChatRole } from "~/resources/IAiChatGateway";
import type { ISpeechToTextGateway } from "~/resources/ISpeechToTextGateway";
import type { IStorageGateway } from "~/resources/IStorageGateway";
import type {
  IWhatsAppMessagingGateway,
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
} from "~/resources/IWhatsAppMessagingGateway";
import type { AuthService } from "~/services/AuthService";
import type { IMediator } from "~/utils/Mediator";
import { MessageLoader, MessageTemplate } from "~/utils/MessageLoader";

export interface TranscriptDTO {
  id: string;
  transcript: string;
  mediaUrl: string | undefined;
  mimeType: string | undefined;
  createdAt: Date;
}

export interface RespondToMessageEvent {
  chat: Chat;
  message: Message;
}

export class MessagingService {
  private database: Database;
  private authService: AuthService;
  private mediator: IMediator;
  private whatsAppMessagingGateway: IWhatsAppMessagingGateway;
  private aiChatGateway: IAiChatGateway;
  private storageGateway: IStorageGateway;
  private speechToTextGateway: ISpeechToTextGateway;
  private summarizationConfig: SummarizationConfig;

  constructor(
    database: Database,
    authService: AuthService,
    mediator: IMediator,
    whatsAppMessagingGateway: IWhatsAppMessagingGateway,
    aiChatGateway: IAiChatGateway,
    storageGateway: IStorageGateway,
    speechToTextGateway: ISpeechToTextGateway,
    summarizationConfig: SummarizationConfig,
  ) {
    this.database = database;
    this.authService = authService;
    this.mediator = mediator;
    this.whatsAppMessagingGateway = whatsAppMessagingGateway;
    this.aiChatGateway = aiChatGateway;
    this.storageGateway = storageGateway;
    this.speechToTextGateway = speechToTextGateway;
    this.summarizationConfig = summarizationConfig;
  }

  async receiveMessage(rawBody: string, signature?: string): Promise<void> {
    if (
      signature == null ||
      !this.whatsAppMessagingGateway.validateSignature(signature, rawBody)
    ) {
      throw new UnauthorizedException(
        "Invalid Signature",
        "Please check your request signature.",
      );
    }
    const data = JSON.parse(rawBody);
    const receiveMessage = this.whatsAppMessagingGateway.receiveMessage(data);
    if (receiveMessage != null) {
      await this.listenToMessage(receiveMessage);
    }
  }

  async listenToMessage(receiveMessage: ReceiveMessageDTO): Promise<void> {
    if (await this.isMessageDuplicate(receiveMessage.idProvider)) return;
    if (!(await this.isAllowedNumber(receiveMessage.from))) return;
    let chat = await this.getChatByPhoneNumber(receiveMessage.from);
    if (chat == null) {
      chat = new Chat();
      chat.phoneNumber = receiveMessage.from;
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
    if (chat.idUser == null) {
      const user = await this.authService.getUserByPhoneNumber(
        chat.phoneNumber,
      );
      if (user == null) {
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
    this.mediator
      .send("RespondToMessage", {
        chat,
        message,
      } as RespondToMessageEvent)
      .catch((err) => {
        console.error(err);
      });
  }

  async respondToMessage(chat: Chat, message: Message): Promise<void> {
    if (message.type === MessageType.Audio) {
      if (message.mediaId == null || message.mimeType == null) return;
      await this.sendTextMessage(
        chat.phoneNumber,
        MessageLoader.getMessage(MessageTemplate.ProcessingAudio),
        chat,
      );
      const mediaContent =
        await this.whatsAppMessagingGateway.downloadMediaAsync(message.mediaId);
      const key = `audio/${chat.id}/${uuidv4()}${getExtension(message.mimeType)}`;
      const permanentUrl = await this.storageGateway.uploadFileAsync({
        key,
        content: mediaContent,
        contentType: message.mimeType,
      });
      const transcript = await this.speechToTextGateway.transcribeAsync({
        audioStream: mediaContent,
        mimeType: message.mimeType,
      });
      message.addAudioTranscriptAndUrl(transcript, permanentUrl);
      await this.saveMessage(message);
    }
    const aiMessages: AiChatMessage[] = [];
    if (chat.summary) {
      aiMessages.push({
        role: AiChatRole.System,
        type: AiChatMessageType.Text,
        text: chat.summary,
      });
    }
    aiMessages.push(...parseMessagesToAi(chat.effectiveMessages));
    const response = await this.aiChatGateway.getResponse(
      chat.phoneNumber,
      aiMessages,
    );
    if (response.type === AiChatMessageType.Text) {
      await this.sendTextMessage(chat.phoneNumber, response.text, chat);
    } else if (response.type === AiChatMessageType.Button) {
      await this.sendButtonReplyMessage(
        chat.phoneNumber,
        response.text,
        [...response.buttons],
        chat,
      );
    }
    await this.triggerSummarization(chat);
  }

  async sendTextMessage(
    phoneNumber: string,
    text: string,
    chat?: Chat,
  ): Promise<void> {
    chat ??= await this.getChatByPhoneNumber(phoneNumber);
    if (chat == null) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    const message = chat.addBotTextMessage(text);
    await this.createMessage(message);
    await this.whatsAppMessagingGateway.sendTextMessage({
      to: phoneNumber,
      text,
    });
  }

  async sendButtonReplyMessage(
    phoneNumber: string,
    text: string,
    options: string[],
    chat?: Chat,
  ): Promise<void> {
    chat ??= await this.getChatByPhoneNumber(phoneNumber);
    if (chat == null) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    const message = chat.addBotButtonReply(text, options);
    await this.createMessage(message);
    await this.whatsAppMessagingGateway.sendInteractiveReplyButtonMessage({
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

  private async triggerSummarization(chat: Chat): Promise<void> {
    try {
      if (!chat.shouldSummarize(this.summarizationConfig.messageCountThreshold))
        return;
      const messagesToSummarize = parseMessagesToAi(chat.effectiveMessages);
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
    if (chat == null) {
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
      AND m.type = 'Audio'
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
        m.button_reply_options != null
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
    await this.database.sql`
      INSERT INTO chats (id, id_user, type, phone_number, created_at, updated_at, is_deleted)
      VALUES (${chat.id}, ${chat.idUser ?? null}, ${chat.type}, ${chat.phoneNumber}, ${chat.createdAt}, ${chat.updatedAt}, ${chat.isDeleted})
    `;
    if (chat.messages.length === 0) return;
    for (const message of chat.messages) {
      await this.createMessage(message);
    }
  }

  private async createMessage(message: Message): Promise<boolean> {
    const buttonOptions =
      message.buttonReplyOptions != null
        ? message.buttonReplyOptions.join(",")
        : null;
    const result = await this.database.sql`
      INSERT INTO messages (id, id_chat, type, user_type, text, button_reply, button_reply_options, media_id, media_url, mime_type, transcript, id_provider, created_at, updated_at)
      VALUES (${message.id}, ${message.idChat}, ${message.type}, ${message.userType}, ${message.text ?? null}, ${message.buttonReply ?? null}, ${buttonOptions}, ${message.mediaId ?? null}, ${message.mediaUrl ?? null}, ${message.mimeType ?? null}, ${message.transcript ?? null}, ${message.idProvider ?? null}, ${message.createdAt}, ${message.updatedAt})
      ON CONFLICT (id_provider) WHERE id_provider IS NOT NULL DO NOTHING
    `;
    return result.count > 0;
  }

  private async saveMessage(message: Message): Promise<void> {
    const buttonOptions =
      message.buttonReplyOptions != null
        ? message.buttonReplyOptions.join(",")
        : null;
    await this.database.sql`
      UPDATE messages SET
        text = ${message.text ?? null},
        button_reply = ${message.buttonReply ?? null},
        button_reply_options = ${buttonOptions},
        media_id = ${message.mediaId ?? null},
        media_url = ${message.mediaUrl ?? null},
        mime_type = ${message.mimeType ?? null},
        transcript = ${message.transcript ?? null},
        updated_at = ${message.updatedAt}
      WHERE id = ${message.id}
    `;
  }

  private async saveChat(chat: Chat): Promise<void> {
    await this.database.sql`
      UPDATE chats SET
        id_user = ${chat.idUser ?? null},
        type = ${chat.type},
        phone_number = ${chat.phoneNumber},
        updated_at = ${chat.updatedAt},
        summary = ${chat.summary ?? null},
        summarized_until_id = ${chat.summarizedUntilId ?? null},
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
}

function parseMessagesToAi(messages: Message[]): AiChatMessage[] {
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

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "audio/ogg":
      return ".ogg";
    case "audio/mpeg":
      return ".mp3";
    case "audio/mp4":
      return ".m4a";
    case "audio/aac":
      return ".aac";
    case "audio/amr":
      return ".amr";
    default:
      return ".bin";
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
