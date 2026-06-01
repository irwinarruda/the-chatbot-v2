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
import { BsuidUtils } from "~/shared/entities/BsuidUtils";
import { Chat } from "~/shared/entities/Chat";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";
import { MessageType } from "~/shared/entities/enums/MessageType";
import { MessageUserType } from "~/shared/entities/enums/MessageUserType";
import { Message } from "~/shared/entities/Message";
import { PhoneNumberUtils } from "~/shared/entities/PhoneNumberUtils";

export interface RespondToMessageEvent {
  chat: Chat;
  message: Message;
  channel: ChatChannel;
}

export interface SendMessageRecipient {
  channel: ChatChannel;
  toAddress: string;
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
    if (!receiveMessage) return;
    await this.promoteWhatsAppIdIfNeeded(receiveMessage);
    await this.listenToMessage(receiveMessage);
  }

  async receiveWebMessage(webAddress: string, body: unknown): Promise<void> {
    const receiveMessage = await this.webMessagingGateway.receiveWebMessage(
      webAddress,
      body,
    );
    if (receiveMessage) {
      await this.listenToMessage(receiveMessage);
    }
  }

  async listenToMessage(receiveMessage: ReceiveMessageDTO): Promise<void> {
    if (await this.isMessageDuplicate(receiveMessage.channelMessageId)) return;
    if (!(await this.isAllowedChannelAddress(receiveMessage))) return;
    let chat = await this.getChatByChannelAddress(
      receiveMessage.fromAddress,
      receiveMessage.channel,
    );
    if (!chat) {
      chat = new Chat();
      chat.setChannelAddress(
        receiveMessage.channel,
        receiveMessage.fromAddress,
      );
      await this.createChat(chat);
    }
    let message: Message;
    if ("text" in receiveMessage) {
      const textMsg = receiveMessage as ReceiveTextMessageDTO;
      message = chat.addUserTextMessage(
        textMsg.text,
        receiveMessage.channelMessageId,
      );
    } else if ("buttonReply" in receiveMessage) {
      const buttonMsg = receiveMessage as ReceiveInteractiveButtonMessageDTO;
      message = chat.addUserButtonReply(
        buttonMsg.buttonReply,
        receiveMessage.channelMessageId,
      );
    } else if ("mediaId" in receiveMessage) {
      const audioMsg = receiveMessage as ReceiveAudioMessageDTO;
      message = chat.addUserAudioMessage(
        audioMsg.mediaId,
        audioMsg.mimeType,
        receiveMessage.channelMessageId,
      );
    } else {
      message = chat.addUserTextMessage("", receiveMessage.channelMessageId);
    }
    if (!(await this.createMessage(message))) return;
    if (!chat.idUser) {
      const user =
        chat.channel === ChatChannel.Web
          ? await this.authService.getUserByEmail(receiveMessage.fromAddress)
          : await this.authService.getUserByBsuidOrPhoneNumber(
              receiveMessage.fromAddress,
            );
      if (!user) {
        if (chat.channel === ChatChannel.Web) return;
        await this.sendLoginMessage(chat, receiveMessage);
        return;
      }
      chat.addUser(user.id);
      await this.saveChat(chat);
    }
    await this.mediator.send("RespondToMessage", {
      chat,
      message,
      channel: receiveMessage.channel,
    });
  }

  async respondToMessage(
    chat: Chat,
    message: Message,
    channel: ChatChannel,
  ): Promise<void> {
    const channelAddress = chat.getChannelAddress();
    const recipient: SendMessageRecipient = {
      channel,
      toAddress: channelAddress,
    };
    const gateway = this.getMessagingGatewayByChannel(channel);
    if (message.type === MessageType.Audio) {
      if (!message.mediaId || !message.mimeType) return;
      await this.sendTextMessage(
        recipient,
        MessageLoader.getMessage(MessageTemplate.ProcessingAudio),
        chat,
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
      if (channel === ChatChannel.Web) {
        this.webMessagingGateway.enqueue(channelAddress, {
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
      channelAddress,
      aiMessages,
      true,
      { idSourceMessage: message.id },
    );
    if (response.type === AiChatMessageType.Text) {
      await this.sendTextMessage(recipient, response.text, chat);
    } else if (response.type === AiChatMessageType.Button) {
      await this.sendButtonReplyMessage(
        recipient,
        response.text,
        [...response.buttons],
        chat,
      );
    }
    await this.triggerSummarization(chat);
  }

  async sendTextMessage(
    recipient: string | SendMessageRecipient,
    text: string,
    chat?: Chat,
  ): Promise<void> {
    const dto =
      typeof recipient === "string"
        ? { channel: ChatChannel.WhatsApp, toAddress: recipient }
        : recipient;
    chat ??= await this.getChatByChannelAddress(dto.toAddress, dto.channel);
    if (!chat) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    const gateway = this.getMessagingGatewayByChannel(dto.channel);
    const message = chat.addBotTextMessage(text);
    await this.createMessage(message);
    await gateway.sendTextMessage({ toAddress: dto.toAddress, text });
  }

  async sendButtonReplyMessage(
    recipient: string | SendMessageRecipient,
    text: string,
    options: string[],
    chat?: Chat,
  ): Promise<void> {
    const dto =
      typeof recipient === "string"
        ? { channel: ChatChannel.WhatsApp, toAddress: recipient }
        : recipient;
    chat ??= await this.getChatByChannelAddress(dto.toAddress, dto.channel);
    if (!chat) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    const gateway = this.getMessagingGatewayByChannel(dto.channel);
    const message = chat.addBotButtonReply(text, options);
    await this.createMessage(message);
    await gateway.sendInteractiveReplyButtonMessage({
      toAddress: dto.toAddress,
      text,
      buttons: options,
    });
  }

  async sendSignedInMessage(channelAddress: string): Promise<void> {
    await this.sendTextMessage(
      channelAddress,
      MessageLoader.getMessage(MessageTemplate.SignedIn),
    );
  }

  async subscribeToWebEvents(
    webAddress: string,
    signal: AbortSignal,
  ): Promise<AsyncGenerator<WebChatEvent>> {
    return this.webMessagingGateway.subscribe(webAddress, signal);
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

  async deleteChat(channelAddress: string): Promise<void> {
    const chat = await this.getChatByChannelAddress(channelAddress);
    if (!chat) {
      throw new ValidationException(
        "The user does not have an open chat",
        "Please create a chat first before continuing",
      );
    }
    chat.deleteChat();
    await this.saveChat(chat);
  }

  validateWebhook(hubMode: string, hubVerifyToken: string): void {
    if (
      !this.whatsAppMessagingGateway.validateWebhook(hubMode, hubVerifyToken)
    ) {
      throw new ValidationException("The provided token did not match");
    }
  }

  async getChatByChannelAddress(
    channelAddress: string,
    channel?: ChatChannel,
  ): Promise<Chat | undefined> {
    if (channel === ChatChannel.WhatsApp) {
      return this.getWhatsAppChatByChannelAddress(channelAddress);
    }
    if (channel === ChatChannel.Web) {
      return this.getWebChatByChannelAddress(channelAddress);
    }
    if (channel !== undefined) {
      throw new ValidationException("Unsupported chat channel");
    }
    return this.getChatByGenericChannelAddress(channelAddress);
  }

  async getChatByPhoneNumber(phoneNumber: string): Promise<Chat | undefined> {
    return this.getChatByChannelAddress(
      PhoneNumberUtils.addDigitNine(phoneNumber),
      ChatChannel.WhatsApp,
    );
  }

  private getMessagingGatewayByChannel(
    channel: ChatChannel,
  ): IMessagingGateway {
    switch (channel) {
      case ChatChannel.WhatsApp:
        return this.whatsAppMessagingGateway;
      case ChatChannel.Web:
        return this.webMessagingGateway;
      default:
        throw new ValidationException("Unsupported chat channel");
    }
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

  private async getChatByGenericChannelAddress(
    channelAddress: string,
  ): Promise<Chat | undefined> {
    const normalizedWhatsAppAddress = BsuidUtils.isValid(channelAddress)
      ? channelAddress
      : PhoneNumberUtils.addDigitNine(channelAddress);
    const dbChats = await this.database.sql<DbChat[]>`
      SELECT * FROM chats
      WHERE is_deleted = false
      AND (
        whatsapp_address = ${channelAddress}
        OR web_address = ${channelAddress}
        OR whatsapp_address = ${normalizedWhatsAppAddress}
      )
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    return this.hydrateChat(dbChat);
  }

  private async getWhatsAppChatByChannelAddress(
    whatsAppAddress: string,
  ): Promise<Chat | undefined> {
    const dbChats = await this.database.sql<DbChat[]>`
      SELECT * FROM chats
      WHERE whatsapp_address = ${whatsAppAddress}
      AND channel = ${ChatChannel.WhatsApp}
      AND is_deleted = false
      ORDER BY created_at DESC
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    return this.hydrateChat(dbChat);
  }

  private async getWebChatByChannelAddress(
    webAddress: string,
  ): Promise<Chat | undefined> {
    const dbChats = await this.database.sql<DbChat[]>`
      SELECT * FROM chats
      WHERE web_address = ${webAddress}
      AND channel = ${ChatChannel.Web}
      AND is_deleted = false
      ORDER BY created_at DESC
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    return this.hydrateChat(dbChat);
  }

  private async hydrateChat(dbChat: DbChat): Promise<Chat> {
    const dbMessages = await this.database.sql<DbMessage[]>`
      SELECT * FROM messages
      WHERE id_chat = ${dbChat.id}
      ORDER BY created_at ASC
    `;
    const chat = new Chat();
    chat.id = dbChat.id;
    chat.idUser = dbChat.id_user ?? undefined;
    chat.channel = dbChat.channel as ChatChannel;
    chat.whatsAppAddress = dbChat.whatsapp_address ?? undefined;
    chat.webAddress = dbChat.web_address ?? undefined;
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
      message.channelMessageId = m.channel_message_id ?? undefined;
      message.createdAt = m.created_at;
      message.updatedAt = m.updated_at;
      return message;
    });
    chat.createdAt = dbChat.created_at;
    chat.updatedAt = dbChat.updated_at;
    chat.isDeleted = dbChat.is_deleted;
    return chat;
  }

  private async sendLoginMessage(
    chat: Chat,
    receiveMessage: ReceiveMessageDTO,
  ): Promise<void> {
    await this.sendTextMessage(
      { channel: ChatChannel.WhatsApp, toAddress: receiveMessage.fromAddress },
      MessageLoader.getMessage(MessageTemplate.ThankYou, {
        loginUrl: this.authService.getAppLoginUrl(receiveMessage.fromAddress),
      }),
      chat,
    );
  }

  private async createChat(chat: Chat): Promise<void> {
    const idUser = chat.idUser ?? null;
    const whatsAppAddress = chat.whatsAppAddress ?? null;
    const webAddress = chat.webAddress ?? null;
    await this.database.sql`
      INSERT INTO chats (
        id,
        id_user,
        channel,
        whatsapp_address,
        web_address,
        created_at,
        updated_at,
        is_deleted
      )
      VALUES (
        ${chat.id},
        ${idUser},
        ${chat.channel},
        ${whatsAppAddress},
        ${webAddress},
        ${chat.createdAt},
        ${chat.updatedAt},
        ${chat.isDeleted}
      )
    `;
    if (chat.messages.length === 0) return;
    for (const message of chat.messages) {
      await this.createMessage(message);
    }
  }

  private async createMessage(message: Message): Promise<boolean> {
    const buttonReplyOptions = message.buttonReplyOptions
      ? message.buttonReplyOptions.join(",")
      : undefined;
    const result = await this.database.sql`
      INSERT INTO messages (
        id,
        id_chat,
        type,
        user_type,
        text,
        button_reply,
        button_reply_options,
        media_id,
        media_url,
        mime_type,
        transcript,
        channel_message_id,
        created_at,
        updated_at
      )
      VALUES (
        ${message.id},
        ${message.idChat},
        ${message.type},
        ${message.userType},
        ${message.text ?? null},
        ${message.buttonReply ?? null},
        ${buttonReplyOptions ?? null},
        ${message.mediaId ?? null},
        ${message.mediaUrl ?? null},
        ${message.mimeType ?? null},
        ${message.transcript ?? null},
        ${message.channelMessageId ?? null},
        ${message.createdAt},
        ${message.updatedAt}
      )
      ON CONFLICT (channel_message_id) WHERE channel_message_id IS NOT NULL DO NOTHING
    `;
    return result.count > 0;
  }

  private async saveMessage(message: Message): Promise<void> {
    const buttonReplyOptions = message.buttonReplyOptions
      ? message.buttonReplyOptions.join(",")
      : undefined;
    await this.database.sql`
      UPDATE messages SET
        text = ${message.text ?? null},
        button_reply = ${message.buttonReply ?? null},
        button_reply_options = ${buttonReplyOptions ?? null},
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
        channel = ${chat.channel},
        whatsapp_address = ${chat.whatsAppAddress ?? null},
        web_address = ${chat.webAddress ?? null},
        updated_at = ${chat.updatedAt},
        summary = ${chat.summary ?? null},
        summarized_until_id = ${chat.summarizedUntilId ?? null},
        is_deleted = ${chat.isDeleted}
      WHERE id = ${chat.id}
    `;
  }

  private async isMessageDuplicate(channelMessageId: string): Promise<boolean> {
    const result = await this.database.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM messages
        WHERE channel_message_id = ${channelMessageId}
      )
    `;
    return result[0]?.exists ?? false;
  }

  private async isAllowedChannelAddress(
    receiveMessage: ReceiveMessageDTO,
  ): Promise<boolean> {
    if (receiveMessage.channel === ChatChannel.WhatsApp) {
      const result = await this.database.sql<{ exists: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM allowed_entries
          WHERE whatsapp_address = ${receiveMessage.fromAddress}
        )
      `;
      return result[0]?.exists ?? false;
    }
    if (receiveMessage.channel === ChatChannel.Web) {
      const result = await this.database.sql<{ exists: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM allowed_entries
          WHERE web_address = ${receiveMessage.fromAddress}
        )
      `;
      return result[0]?.exists ?? false;
    }
    throw new ValidationException("Unsupported chat channel");
  }

  private async promoteWhatsAppIdIfNeeded(
    receiveMessage: ReceiveMessageDTO,
  ): Promise<void> {
    if (receiveMessage.channel !== ChatChannel.WhatsApp) return;
    if (!receiveMessage.whatsAppPhoneNumber) return;
    if (receiveMessage.fromAddress === receiveMessage.whatsAppPhoneNumber)
      return;
    const oldWhatsAppAddress = receiveMessage.whatsAppPhoneNumber;
    const newWhatsAppAddress = receiveMessage.fromAddress;
    const phoneNumber = PhoneNumberUtils.addDigitNine(
      receiveMessage.whatsAppPhoneNumber,
    );
    const now = new Date();
    await this.database.transaction(async (sql) => {
      await sql`
          UPDATE chats
          SET
            whatsapp_address = ${newWhatsAppAddress},
            updated_at = ${now}
          WHERE whatsapp_address = ${oldWhatsAppAddress}
          AND channel = ${ChatChannel.WhatsApp}
        `;
      await sql`
          UPDATE allowed_entries
          SET
            whatsapp_address = ${newWhatsAppAddress}
          WHERE whatsapp_address = ${oldWhatsAppAddress}
        `;
      await sql`
          UPDATE users u
          SET
            bsuid = ${newWhatsAppAddress},
            phone_number = ${phoneNumber},
            updated_at = ${now}
          WHERE u.phone_number = ${phoneNumber}
          AND u.bsuid IS NULL
        `;
    });
  }
}

interface DbChat {
  id: string;
  id_user: string | null;
  phone_number: string | null;
  whatsapp_address: string | null;
  web_address: string | null;
  channel: string;
  summary: string | null;
  summarized_until_id: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
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
  channel_message_id: string | null;
  created_at: Date;
  updated_at: Date;
}
