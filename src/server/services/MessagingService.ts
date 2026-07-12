import { v4 as uuidv4 } from "uuid";
import type { AiConfig } from "~/infra/config";
import type { Database } from "~/infra/database";
import {
  AppError,
  UnauthorizedException,
  ValidationException,
} from "~/infra/exceptions";
import type { IMediator } from "~/infra/mediator";
import type {
  AiChatContextMessage,
  AiToolDefinition,
  IAiChatGateway,
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
import type { IWebMessagingGateway } from "~/server/resources/IWebMessagingGateway";
import type { IWhatsAppMessagingGateway } from "~/server/resources/IWhatsAppMessagingGateway";
import type { AiToolService } from "~/server/services/AiToolService";
import type {
  AuthService,
  SyncUserChatAddressesEvent,
} from "~/server/services/AuthService";
import { MessageLoader, MessageTemplate } from "~/server/utils/MessageLoader";
import { BsuidUtils } from "~/shared/entities/BsuidUtils";
import type { AssistantMessageOptions } from "~/shared/entities/Chat";
import { Chat } from "~/shared/entities/Chat";
import { ConversationSummary } from "~/shared/entities/ConversationSummary";
import { ChatChannel } from "~/shared/entities/enums/ChatChannel";
import { MessageAudience } from "~/shared/entities/enums/MessageAudience";
import { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import { MessageRole } from "~/shared/entities/enums/MessageRole";
import { ToolResultStatus } from "~/shared/entities/enums/ToolResultStatus";
import type { WebChatEvent } from "~/shared/entities/events/WebChatEvent";
import type { MessageContent } from "~/shared/entities/Message";
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
  private aiToolService: AiToolService;
  private storageGateway: IStorageGateway;
  private speechToTextGateway: ISpeechToTextGateway;
  private aiConfig: AiConfig;

  constructor(
    database: Database,
    authService: AuthService,
    mediator: IMediator,
    whatsAppMessagingGateway: IWhatsAppMessagingGateway,
    webMessagingGateway: IWebMessagingGateway,
    aiChatGateway: IAiChatGateway,
    aiToolService: AiToolService,
    storageGateway: IStorageGateway,
    speechToTextGateway: ISpeechToTextGateway,
    aiConfig: AiConfig,
  ) {
    this.database = database;
    this.authService = authService;
    this.mediator = mediator;
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
    if (!chat) {
      chat = new Chat();
      chat.setChannelAddress(
        receiveMessage.channel,
        receiveMessage.fromAddress,
      );
      await this.createChat(chat);
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
    if (!(await this.createMessage(message))) return;
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
          this.webMessagingGateway.enqueue(recipient.toAddress, {
            type: "audio",
            data: {
              mediaUrl: permanentUrl,
              mimeType: baseMimeType,
              transcript,
            },
          });
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

  async syncUserChatAddresses(dto: SyncUserChatAddressesEvent): Promise<void> {
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
    const contextMessages = await this.buildModelContext(
      chat,
      recipient.toAddress,
      tools,
    );
    const response = await this.aiChatGateway.runAgent({
      channelAddress: recipient.toAddress,
      messages: contextMessages,
      tools,
      memory: chat.summary,
      maxToolRounds: this.aiConfig.maxToolRounds,
      onToolCalls: async (calls, content) => {
        if (content) {
          const contentMessage =
            content.type === MessageContentType.Button
              ? chat.addAssistantButtonMessage(
                  content.text,
                  content.options ?? [],
                  {
                    turnId: sourceMessage.turnId,
                    audience: MessageAudience.Model,
                  },
                )
              : chat.addAssistantTextMessage(content.text, {
                  turnId: sourceMessage.turnId,
                  audience: MessageAudience.Model,
                });
          await this.createMessage(contentMessage);
        }
        for (const call of calls) {
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
            continue;
          }
          const callMessage = chat.addAssistantToolCall(
            sourceMessage.turnId,
            call,
          );
          await this.createMessage(callMessage);
        }
      },
      executeTool: async (call) => {
        const existing = chat.getToolResult(sourceMessage.turnId, call.callId);
        if (existing?.content.type === MessageContentType.ToolResult) {
          return existing.content;
        }
        const result = await this.aiToolService.execute(call, {
          chat,
          sourceMessage,
        });
        const resultMessage = chat.addToolResult(sourceMessage.turnId, result);
        await this.createMessage(resultMessage);
        return resultMessage.content as typeof result;
      },
    });
    if (
      !response.content &&
      response.toolRounds >= this.aiConfig.maxToolRounds
    ) {
      await this.sendTextMessage(
        recipient,
        MessageLoader.getMessage(MessageTemplate.ToolRoundsExceeded),
        chat,
        { turnId: sourceMessage.turnId },
      );
      return;
    }
    const content = response.content;
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
    let currentTurnId: string | undefined;
    const messages = dbMessages.map((dbMessage) => {
      if (dbMessage.turn_id) {
        currentTurnId = dbMessage.turn_id;
      } else if (dbMessage.user_type === "User") {
        currentTurnId = dbMessage.id;
      }
      return this.hydrateMessage(dbMessage, currentTurnId ?? dbMessage.id);
    });
    const chat = new Chat();
    chat.id = dbChat.id;
    chat.idUser = dbChat.id_user ?? undefined;
    chat.channel = dbChat.channel as ChatChannel;
    chat.whatsAppAddress = dbChat.whatsapp_address ?? undefined;
    chat.webAddress = dbChat.web_address ?? undefined;
    chat.messages = messages;
    const conversationSummary = this.parseJsonColumn<ConversationSummary>(
      dbChat.conversation_summary,
    );
    if (conversationSummary) {
      chat.summary = new ConversationSummary({
        userProfile: conversationSummary.userProfile,
        durableFacts: conversationSummary.durableFacts,
        compactedThroughSequence: conversationSummary.compactedThroughSequence,
      });
    } else if (dbChat.summary && dbChat.summarized_until_id) {
      const cursorMessage = messages.find(
        (message) => message.id === dbChat.summarized_until_id,
      );
      if (cursorMessage?.sequence !== undefined) {
        const legacySummary = this.parseLegacySummary(dbChat.summary);
        chat.summary = legacySummary
          ? new ConversationSummary({
              userProfile: legacySummary.userProfile,
              durableFacts: legacySummary.durableFacts,
              compactedThroughSequence: cursorMessage.sequence,
            })
          : new ConversationSummary({
              userProfile: [dbChat.summary],
              durableFacts: [],
              compactedThroughSequence: cursorMessage.sequence,
            });
      }
    }
    chat.createdAt = dbChat.created_at;
    chat.updatedAt = dbChat.updated_at;
    chat.isDeleted = dbChat.is_deleted;
    return chat;
  }

  private hydrateMessage(
    dbMessage: DbMessage,
    fallbackTurnId: string,
  ): Message {
    const content =
      this.parseJsonColumn<MessageContent>(dbMessage.content) ??
      this.getCanonicalContentFromLegacyMessage(dbMessage);
    return Message.restore({
      id: dbMessage.id,
      idChat: dbMessage.id_chat,
      turnId: dbMessage.turn_id ?? fallbackTurnId,
      sequence: Number(dbMessage.sequence),
      role:
        dbMessage.role ??
        (dbMessage.user_type === "User"
          ? MessageRole.User
          : MessageRole.Assistant),
      audience: dbMessage.audience ?? MessageAudience.Both,
      content,
      channelMessageId: dbMessage.channel_message_id ?? undefined,
      createdAt: dbMessage.created_at,
      updatedAt: dbMessage.updated_at,
    });
  }

  private getCanonicalContentFromLegacyMessage(
    dbMessage: DbMessage,
  ): MessageContent {
    if (dbMessage.type === "Audio") {
      return {
        type: MessageContentType.Audio,
        mediaId: dbMessage.media_id ?? undefined,
        mediaUrl: dbMessage.media_url ?? undefined,
        mimeType: dbMessage.mime_type ?? "audio/ogg",
        transcript: dbMessage.transcript ?? undefined,
      };
    }
    if (dbMessage.type === "Interactive") {
      if (dbMessage.user_type === "User") {
        return {
          type: MessageContentType.Button,
          text: dbMessage.button_reply ?? "",
        };
      }
      return {
        type: MessageContentType.Button,
        text: dbMessage.text ?? "",
        options: dbMessage.button_reply_options?.split(",") ?? undefined,
      };
    }
    return { type: MessageContentType.Text, text: dbMessage.text ?? "" };
  }

  private parseLegacySummary(summary: string): ConversationSummary | undefined {
    try {
      const value = JSON.parse(summary) as Partial<ConversationSummary>;
      if (
        !Array.isArray(value.userProfile) ||
        !Array.isArray(value.durableFacts)
      ) {
        return undefined;
      }
      return value as ConversationSummary;
    } catch {
      return undefined;
    }
  }

  private parseJsonColumn<T>(value: unknown): T | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "string") return JSON.parse(value) as T;
    return value as T;
  }

  private getLegacyMessageColumns(message: Message) {
    const content = message.content;
    return {
      type:
        content.type === MessageContentType.Audio
          ? "Audio"
          : content.type === MessageContentType.Button
            ? "Interactive"
            : "Text",
      userType: message.role === MessageRole.User ? "User" : "Bot",
      text:
        content.type === MessageContentType.Text
          ? content.text
          : content.type === MessageContentType.Button &&
              message.role !== MessageRole.User
            ? content.text
            : null,
      buttonReply:
        content.type === MessageContentType.Button &&
        message.role === MessageRole.User
          ? content.text
          : null,
      buttonReplyOptions:
        content.type === MessageContentType.Button && content.options
          ? content.options.join(",")
          : null,
      mediaId:
        content.type === MessageContentType.Audio
          ? (content.mediaId ?? null)
          : null,
      mediaUrl:
        content.type === MessageContentType.Audio
          ? (content.mediaUrl ?? null)
          : null,
      mimeType:
        content.type === MessageContentType.Audio ? content.mimeType : null,
      transcript:
        content.type === MessageContentType.Audio
          ? (content.transcript ?? null)
          : null,
    };
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
    const legacy = this.getLegacyMessageColumns(message);
    const result = await this.database.sql<{ sequence: string }[]>`
      INSERT INTO messages (
        id,
        id_chat,
        turn_id,
        role,
        audience,
        content,
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
        ${message.turnId},
        ${message.role},
        ${message.audience},
        ${this.database.json(message.content)},
        ${legacy.type},
        ${legacy.userType},
        ${legacy.text},
        ${legacy.buttonReply},
        ${legacy.buttonReplyOptions},
        ${legacy.mediaId},
        ${legacy.mediaUrl},
        ${legacy.mimeType},
        ${legacy.transcript},
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
    const legacy = this.getLegacyMessageColumns(message);
    await this.database.sql`
      UPDATE messages SET
        content = ${this.database.json(message.content)},
        type = ${legacy.type},
        user_type = ${legacy.userType},
        text = ${legacy.text},
        button_reply = ${legacy.buttonReply},
        button_reply_options = ${legacy.buttonReplyOptions},
        media_id = ${legacy.mediaId},
        media_url = ${legacy.mediaUrl},
        mime_type = ${legacy.mimeType},
        transcript = ${legacy.transcript},
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
        summary = ${JSON.stringify(chat.summary)},
        summarized_until_id = ${cursorMessage.id},
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
  summary: string | null;
  summarized_until_id: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DbMessage {
  id: string;
  id_chat: string;
  turn_id: string | null;
  sequence: string;
  role: string | null;
  audience: string | null;
  content: unknown;
  type: string;
  user_type: string;
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
