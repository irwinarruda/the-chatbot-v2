import { v4 as uuidv4 } from "uuid";
import {
  toMessageCreatedEvent,
  toMessageUpdatedEvent,
} from "~/modules/chat/contracts/ChatContractMapper";
import type { AssistantMessageOptions } from "~/modules/chat/entities/Chat";
import { Chat } from "~/modules/chat/entities/Chat";
import { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type { WebChatEvent } from "~/modules/chat/entities/dtos/ChatDTO";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import type { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { Message } from "~/modules/chat/entities/Message";
import type {
  AiChatContextMessage,
  AiChatGateway,
  AiToolDefinition,
} from "~/modules/chat/gateway/AiChatGateway";
import type {
  MessagingGateway,
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
} from "~/modules/chat/gateway/MessagingGateway";
import type { SpeechToTextGateway } from "~/modules/chat/gateway/SpeechToTextGateway";
import type { StorageGateway } from "~/modules/chat/gateway/StorageGateway";
import type { WebMessagingGateway } from "~/modules/chat/gateway/WebMessagingGateway";
import type { WhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway";
import type { ToolExecutor } from "~/modules/chat/services/ToolExecutor";
import {
  MessageLoader,
  MessageTemplate,
} from "~/modules/chat/utils/MessageLoader";
import { BsuidUtils } from "~/modules/identity/entities/BsuidUtils";
import { PhoneNumberUtils } from "~/modules/identity/entities/PhoneNumberUtils";
import type {
  AuthService,
  SyncUserChatAddresses,
} from "~/modules/identity/services/AuthService";
import type { AiConfig } from "~/shared/config/Config";
import {
  AppError,
  UnauthorizedException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

export interface SendMessageRecipient {
  channel: ChatChannel;
  toAddress: string;
}

export class MessagingService {
  private database: DatabaseGateway;
  private authService: AuthService;
  private whatsAppMessagingGateway: WhatsAppMessagingGateway;
  private webMessagingGateway: WebMessagingGateway;
  private aiChatGateway: AiChatGateway;
  private aiToolService: ToolExecutor;
  private storageGateway: StorageGateway;
  private speechToTextGateway: SpeechToTextGateway;
  private aiConfig: AiConfig;

  constructor(
    database: DatabaseGateway,
    authService: AuthService,
    whatsAppMessagingGateway: WhatsAppMessagingGateway,
    webMessagingGateway: WebMessagingGateway,
    aiChatGateway: AiChatGateway,
    aiToolService: ToolExecutor,
    storageGateway: StorageGateway,
    speechToTextGateway: SpeechToTextGateway,
    aiConfig: AiConfig,
  ) {
    this.database = database;
    this.authService = authService;
    this.whatsAppMessagingGateway = whatsAppMessagingGateway;
    this.webMessagingGateway = webMessagingGateway;
    this.aiChatGateway = aiChatGateway;
    this.aiToolService = aiToolService;
    this.storageGateway = storageGateway;
    this.speechToTextGateway = speechToTextGateway;
    this.aiConfig = aiConfig;
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
    let isNewChat = false;
    if (!chat) {
      chat = new Chat();
      chat.setChannelAddress(
        receiveMessage.channel,
        receiveMessage.fromAddress,
      );
      isNewChat = true;
    } else {
      chat.setChannelAddress(
        receiveMessage.channel,
        receiveMessage.fromAddress,
      );
      await this.saveChat(chat);
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
      message = chat.addUserButtonMessage(
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
    const created = isNewChat
      ? await this.database.transaction(async (sql) => {
          await this.createChat(chat, sql);
          return this.createMessage(message, sql);
        })
      : await this.createMessage(message);
    if (!created) return;
    if (receiveMessage.channel === ChatChannel.Web) {
      this.webMessagingGateway.enqueue(
        receiveMessage.fromAddress,
        toMessageCreatedEvent(message),
      );
    }
    if (!chat.idUser) {
      const user =
        chat.channel === ChatChannel.Web
          ? await this.authService.getUserByEmail(receiveMessage.fromAddress)
          : await this.authService.getUserByChatChannelAddress(
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
    await this.respondToMessage(chat, message, receiveMessage.channel);
  }

  async respondToMessage(
    chat: Chat,
    message: Message,
    channel: ChatChannel,
  ): Promise<void> {
    const recipient: SendMessageRecipient = {
      channel,
      toAddress: chat.getChannelAddress(),
    };
    try {
      if (message.content.type === MessageContentType.Audio) {
        const { mediaId, mimeType } = message.content;
        if (!mediaId || !mimeType) return;
        await this.sendTextMessage(
          recipient,
          MessageLoader.getMessage(MessageTemplate.ProcessingAudio),
          chat,
          { turnId: message.turnId, audience: MessageAudience.Channel },
        );
        const gateway = this.getMessagingGatewayByChannel(recipient.channel);
        const mediaContent = await gateway.downloadMediaAsync(mediaId);
        const baseMimeType = mimeType.split(";")[0].trim().toLowerCase();
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
        if (recipient.channel === ChatChannel.Web) {
          this.webMessagingGateway.enqueue(
            recipient.toAddress,
            toMessageUpdatedEvent(message),
          );
        }
      }
      await this.runAiAgent(chat, message, recipient);
    } catch (ex) {
      let text =
        ex instanceof AppError
          ? `⚠️ ${ex.message}\n${ex.action}`
          : MessageLoader.getMessage(MessageTemplate.UnexpectedError);
      if (import.meta.env.DEV) {
        const detail =
          ex instanceof Error
            ? `${ex.message}${ex.stack ? `\n${ex.stack}` : ""}`
            : String(ex);
        text = `${text}\n\n${detail}`;
      }
      await this.sendTextMessage(recipient, text, chat, {
        turnId: message.turnId,
        audience: MessageAudience.Both,
      });
    }
  }

  async sendTextMessage(
    recipient: string | SendMessageRecipient,
    text: string,
    chat?: Chat,
    options?: AssistantMessageOptions,
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
    const message = chat.addAssistantTextMessage(text, options);
    await this.createMessage(message);
    if (dto.channel === ChatChannel.Web) {
      this.webMessagingGateway.enqueue(
        dto.toAddress,
        toMessageCreatedEvent(message),
      );
    }
    await gateway.sendTextMessage({ toAddress: dto.toAddress, text });
  }

  async sendButtonReplyMessage(
    recipient: string | SendMessageRecipient,
    text: string,
    options: string[],
    chat?: Chat,
    messageOptions?: AssistantMessageOptions,
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
    const message = chat.addAssistantButtonMessage(
      text,
      options,
      messageOptions,
    );
    await this.createMessage(message);
    if (dto.channel === ChatChannel.Web) {
      this.webMessagingGateway.enqueue(
        dto.toAddress,
        toMessageCreatedEvent(message),
      );
    }
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

  async syncUserChatAddresses(dto: SyncUserChatAddresses): Promise<void> {
    const phoneNumber = dto.phoneNumber
      ? PhoneNumberUtils.addDigitNine(dto.phoneNumber)
      : null;
    await this.database.sql`
      UPDATE chats
      SET
        id_user = ${dto.idUser},
        web_address = COALESCE(${dto.email ?? null}, web_address),
        updated_at = ${new Date()}
      WHERE is_deleted = false
      AND (
        id_user = ${dto.idUser}
        OR web_address = ${dto.email ?? null}
        OR whatsapp_address = ${dto.bsuid ?? null}
        OR whatsapp_address = ${phoneNumber}
      )
    `;
  }

  private async runAiAgent(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipient,
  ): Promise<void> {
    for (const message of chat.messages) {
      if (
        message.content.type !== MessageContentType.ToolCall ||
        chat.getToolResult(message.turnId, message.content.callId)
      ) {
        continue;
      }
      const result = chat.addToolResult(message.turnId, {
        type: MessageContentType.ToolResult,
        callId: message.content.callId,
        outcome: {
          status: ToolResultStatus.Unknown,
          code: "UnconfirmedOutcome",
          message:
            "The previous operation may have completed, but its outcome could not be confirmed.",
        },
      });
      await this.createMessage(result);
    }
    const tools = this.aiToolService.getDefinitions();
    for (let round = 0; round < this.aiConfig.maxToolRounds; round++) {
      const contextMessages = await this.buildModelContext(
        chat,
        recipient.toAddress,
        tools,
      );
      const response = await this.aiChatGateway.complete({
        channelAddress: recipient.toAddress,
        messages: contextMessages,
        tools,
        memory: chat.summary,
      });
      if (response.toolCalls.length === 0) {
        await this.sendAssistantContent(
          chat,
          sourceMessage,
          recipient,
          response.content,
        );
        return;
      }
      if (response.content) {
        const contentMessage =
          response.content.type === MessageContentType.Button
            ? chat.addAssistantButtonMessage(
                response.content.text,
                response.content.options ?? [],
                {
                  turnId: sourceMessage.turnId,
                  audience: MessageAudience.Model,
                },
              )
            : chat.addAssistantTextMessage(response.content.text, {
                turnId: sourceMessage.turnId,
                audience: MessageAudience.Model,
              });
        await this.createMessage(contentMessage);
      }
      for (const call of response.toolCalls) {
        const existing = chat.getToolCall(sourceMessage.turnId, call.callId);
        if (existing) {
          if (
            existing.content.type !== MessageContentType.ToolCall ||
            existing.content.name !== call.name ||
            JSON.stringify(existing.content.arguments) !==
              JSON.stringify(call.arguments)
          ) {
            throw new ValidationException(
              "A tool call ID was reused with different arguments",
            );
          }
        } else {
          const callMessage = chat.addAssistantToolCall(
            sourceMessage.turnId,
            call,
          );
          await this.createMessage(callMessage);
        }
      }
      for (const call of response.toolCalls) {
        const existingResult = chat.getToolResult(
          sourceMessage.turnId,
          call.callId,
        );
        if (existingResult?.content.type === MessageContentType.ToolResult) {
          continue;
        }
        const result = await this.aiToolService.execute(call, {
          chat,
          sourceMessage,
        });
        const resultMessage = chat.addToolResult(sourceMessage.turnId, result);
        await this.createMessage(resultMessage);
      }
    }
    await this.sendTextMessage(
      recipient,
      MessageLoader.getMessage(MessageTemplate.ToolRoundsExceeded),
      chat,
      { turnId: sourceMessage.turnId },
    );
  }

  private async sendAssistantContent(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipient,
    content?: import("~/modules/chat/gateway/AiChatGateway").AssistantChannelContent,
  ): Promise<void> {
    if (content?.type === MessageContentType.Button) {
      await this.sendButtonReplyMessage(
        recipient,
        content.text,
        [...(content.options ?? [])],
        chat,
        { turnId: sourceMessage.turnId },
      );
      return;
    }
    await this.sendTextMessage(recipient, content?.text ?? "", chat, {
      turnId: sourceMessage.turnId,
    });
  }

  private async buildModelContext(
    chat: Chat,
    channelAddress: string,
    tools: AiToolDefinition[],
  ): Promise<AiChatContextMessage[]> {
    const inputBudget =
      this.aiChatGateway.getContextWindowTokens() -
      this.aiConfig.maxOutputTokens -
      this.aiConfig.safetyMarginTokens;
    for (let attempt = 0; attempt <= chat.messages.length + 1; attempt++) {
      const messages = chat.getModelMessages().map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const requestTokens = this.aiChatGateway.estimateInputTokens({
        channelAddress,
        messages,
        tools,
        memory: chat.summary,
      });
      if (requestTokens <= inputBudget) return messages;
      const turns = chat.getUncompactedTurns();
      const protectedCount = Math.min(
        this.aiConfig.minRecentTurns,
        turns.length,
      );
      const oldestTurn = turns[0];
      if (
        !oldestTurn ||
        turns.length <= protectedCount ||
        !Chat.isTurnComplete(oldestTurn)
      ) {
        break;
      }
      await this.compactChat(chat, [oldestTurn]);
    }
    throw new ValidationException(
      "The protected recent turns exceed the configured AI context budget",
      "Use a model with a larger context window or reduce AI_MIN_RECENT_TURNS.",
    );
  }

  private async compactChat(chat: Chat, turns: Message[][]): Promise<void> {
    const messages = turns.flat();
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sequence === undefined) {
      throw new ValidationException(
        "Cannot compact messages without a persisted sequence",
      );
    }
    const previousSummary = chat.summary;
    const previousUpdatedAt = chat.updatedAt;
    const candidate = await this.aiChatGateway.generateSummary(
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      previousSummary,
    );
    chat.setSummary(
      new ConversationSummary({
        userProfile: candidate.userProfile,
        durableFacts: candidate.durableFacts,
        compactedThroughSequence: lastMessage.sequence,
      }),
    );
    try {
      await this.saveChatSummary(chat, previousSummary);
    } catch (ex) {
      chat.summary = previousSummary;
      chat.updatedAt = previousUpdatedAt;
      throw ex;
    }
  }

  private getMessagingGatewayByChannel(channel: ChatChannel): MessagingGateway {
    switch (channel) {
      case ChatChannel.WhatsApp:
        return this.whatsAppMessagingGateway;
      case ChatChannel.Web:
        return this.webMessagingGateway;
      default:
        throw new ValidationException("Unsupported chat channel");
    }
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

  private async getChatByGenericChannelAddress(
    channelAddress: string,
  ): Promise<Chat | undefined> {
    const normalizedWhatsAppAddress = BsuidUtils.containsLetter(channelAddress)
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
      AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT 1
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
      AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const dbChat = dbChats[0];
    if (!dbChat) return undefined;
    return this.hydrateChat(dbChat);
  }

  private async hydrateChat(dbChat: DbChat): Promise<Chat> {
    const dbMessages = await this.database.sql<DbMessage[]>`
      SELECT * FROM messages
      WHERE id_chat = ${dbChat.id}
      ORDER BY sequence ASC
    `;
    const messages = dbMessages.map((dbMessage) =>
      Message.restore({
        id: dbMessage.id,
        idChat: dbMessage.id_chat,
        turnId: dbMessage.turn_id,
        sequence: Number(dbMessage.sequence),
        role: dbMessage.role,
        audience: dbMessage.audience,
        content: this.parseJsonColumn(dbMessage.content),
        channelMessageId: dbMessage.channel_message_id ?? undefined,
        createdAt: dbMessage.created_at,
        updatedAt: dbMessage.updated_at,
      }),
    );
    let summary: ConversationSummary | undefined;
    const conversationSummary = dbChat.conversation_summary
      ? this.parseJsonColumn<ConversationSummary>(dbChat.conversation_summary)
      : undefined;
    if (conversationSummary) {
      summary = new ConversationSummary({
        userProfile: conversationSummary.userProfile,
        durableFacts: conversationSummary.durableFacts,
        compactedThroughSequence: conversationSummary.compactedThroughSequence,
      });
    }
    return Chat.restore({
      id: dbChat.id,
      idUser: dbChat.id_user ?? undefined,
      channel: dbChat.channel as ChatChannel,
      whatsAppAddress: dbChat.whatsapp_address ?? undefined,
      webAddress: dbChat.web_address ?? undefined,
      messages,
      summary,
      createdAt: dbChat.created_at,
      updatedAt: dbChat.updated_at,
      isDeleted: dbChat.is_deleted,
    });
  }

  private parseJsonColumn<T>(value: unknown): T {
    if (typeof value === "string") return JSON.parse(value) as T;
    return value as T;
  }

  private async createChat(
    chat: Chat,
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<void> {
    const idUser = chat.idUser ?? null;
    const whatsAppAddress = chat.whatsAppAddress ?? null;
    const webAddress = chat.webAddress ?? null;
    await sql`
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
  }

  private async createMessage(
    message: Message,
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<boolean> {
    const result = await sql<{ sequence: string }[]>`
      INSERT INTO messages (
        id,
        id_chat,
        turn_id,
        role,
        audience,
        content,
        channel_message_id,
        created_at,
        updated_at
      )
      VALUES (
        ${message.id},
        ${message.idChat},
        ${message.turnId},
        ${message.role},
        ${message.audience},
        ${this.database.json(message.content)},
        ${message.channelMessageId ?? null},
        ${message.createdAt},
        ${message.updatedAt}
      )
      ON CONFLICT (channel_message_id) WHERE channel_message_id IS NOT NULL DO NOTHING
      RETURNING sequence
    `;
    const inserted = result[0];
    if (!inserted) return false;
    message.sequence = Number(inserted.sequence);
    return true;
  }

  private async saveMessage(message: Message): Promise<void> {
    await this.database.sql`
      UPDATE messages SET
        content = ${this.database.json(message.content)},
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
        is_deleted = ${chat.isDeleted}
      WHERE id = ${chat.id}
    `;
  }

  private async saveChatSummary(
    chat: Chat,
    expectedSummary?: ConversationSummary,
  ): Promise<void> {
    if (!chat.summary) {
      throw new ValidationException("Conversation summary is required");
    }
    const cursorMessage = chat.messages.find(
      (message) => message.sequence === chat.summary?.compactedThroughSequence,
    );
    if (!cursorMessage) {
      throw new ValidationException(
        "The summary cursor must reference a persisted message",
      );
    }
    const result = await this.database.sql<{ id: string }[]>`
      UPDATE chats SET
        conversation_summary = ${this.database.json(chat.summary)},
        updated_at = ${chat.updatedAt}
      WHERE id = ${chat.id}
      AND conversation_summary IS NOT DISTINCT FROM ${
        expectedSummary ? this.database.json(expectedSummary) : null
      }::jsonb
      AND (
        conversation_summary IS NULL
        OR (conversation_summary->>'compactedThroughSequence')::bigint
          < ${chat.summary.compactedThroughSequence}
      )
      RETURNING id
    `;
    if (!result[0]) {
      throw new ValidationException(
        "Conversation memory changed while it was being compacted",
      );
    }
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
    if (receiveMessage.channel === ChatChannel.Web) return true;
    const result = await this.database.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM allowed_entries
        WHERE channel = ${receiveMessage.channel}
        AND channel_address = ${receiveMessage.fromAddress}
      )
    `;
    return result[0]?.exists ?? false;
  }
}

interface DbChat {
  id: string;
  id_user: string | null;
  phone_number: string | null;
  whatsapp_address: string | null;
  web_address: string | null;
  channel: string;
  conversation_summary: unknown;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbMessage {
  id: string;
  id_chat: string;
  turn_id: string;
  sequence: string;
  role: MessageRole;
  audience: MessageAudience;
  content: unknown;
  channel_message_id: string | null;
  created_at: Date;
  updated_at: Date;
}
