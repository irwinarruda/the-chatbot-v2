import { v4 as uuidv4 } from "uuid";
import { AiGeneration } from "~/modules/chat/entities/AiGeneration";
import type { AssistantMessageOptions } from "~/modules/chat/entities/Chat";
import { Chat } from "~/modules/chat/entities/Chat";
import { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type { ChatResponseProgressEventDTO } from "~/modules/chat/entities/dtos/ChatDTO";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { MessageAudience } from "~/modules/chat/entities/enums/MessageAudience";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import type { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import {
  isReasoningEffort,
  type ReasoningEffort,
} from "~/modules/chat/entities/enums/ReasoningEffort";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { Message } from "~/modules/chat/entities/Message";
import type {
  AiChatContextMessageDTO,
  AiChatGateway,
  AiToolDefinitionDTO,
} from "~/modules/chat/gateway/AiChatGateway";
import type {
  MessagingGateway,
  ReceiveAudioMessageDTO,
  ReceiveInteractiveButtonMessageDTO,
  ReceiveMessageDTO,
  ReceiveTextMessageDTO,
  SendMessageRecipientDTO,
} from "~/modules/chat/gateway/MessagingGateway";
import type { SpeechToTextGateway } from "~/modules/chat/gateway/SpeechToTextGateway";
import type { StorageGateway } from "~/modules/chat/gateway/StorageGateway";
import type { WebMessagingGateway } from "~/modules/chat/gateway/WebMessagingGateway";
import type { WhatsAppMessagingGateway } from "~/modules/chat/gateway/WhatsAppMessagingGateway";
import type { ToolExecutor } from "~/modules/chat/services/ToolExecutor";
import { parseChatCommand } from "~/modules/chat/utils/ChatCommandParser";
import {
  MessageLoader,
  MessageLocale,
  MessageTemplate,
} from "~/modules/chat/utils/MessageLoader";
import { BsuidUtils } from "~/modules/identity/entities/BsuidUtils";
import type { SyncUserChatAddressesDTO } from "~/modules/identity/entities/dtos/IdentityDTO";
import { PhoneNumberUtils } from "~/modules/identity/entities/PhoneNumberUtils";
import type { AuthService } from "~/modules/identity/services/AuthService";
import type { AiConfig } from "~/shared/config/Config";
import {
  AppError,
  UnauthorizedException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

type ChatResponseProgressListener = (
  event: ChatResponseProgressEventDTO,
) => void;

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

  async receiveWebMessage(
    webAddress: string,
    body: unknown,
    onProgress?: ChatResponseProgressListener,
    locale: MessageLocale = MessageLocale.PtBr,
  ): Promise<Chat | undefined> {
    const receiveMessage = await this.webMessagingGateway.receiveWebMessage(
      webAddress,
      body,
    );
    if (!receiveMessage) {
      return this.getChatByChannelAddress(
        webAddress.toLowerCase(),
        ChatChannel.Web,
      );
    }
    await this.listenToMessage(receiveMessage, onProgress, locale);
    return this.getChatByChannelAddress(
      receiveMessage.fromAddress,
      ChatChannel.Web,
    );
  }

  getSupportedReasoningEfforts(): ReasoningEffort[] {
    return this.aiChatGateway.getSupportedReasoningEfforts();
  }

  async listenToMessage(
    receiveMessage: ReceiveMessageDTO,
    onProgress?: ChatResponseProgressListener,
    locale: MessageLocale = MessageLocale.PtBr,
  ): Promise<void> {
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
      await this.saveChatChannelAddress(chat);
    }
    let message: Message;
    if ("text" in receiveMessage) {
      const textMsg = receiveMessage as ReceiveTextMessageDTO;
      const command = parseChatCommand(textMsg.text);
      if (command) {
        message = chat.addUserCommandMessage(
          command.raw,
          command.name,
          command.arguments,
          receiveMessage.channelMessageId,
        );
      } else {
        message = chat.addUserTextMessage(
          textMsg.text,
          receiveMessage.channelMessageId,
        );
      }
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
    await this.respondToMessage(
      chat,
      message,
      receiveMessage.channel,
      onProgress,
      locale,
    );
  }

  async respondToMessage(
    chat: Chat,
    message: Message,
    channel: ChatChannel,
    onProgress?: ChatResponseProgressListener,
    locale: MessageLocale = MessageLocale.PtBr,
  ): Promise<void> {
    const recipient: SendMessageRecipientDTO = {
      channel,
      toAddress: chat.getChannelAddress(),
    };
    try {
      if (message.content.type === MessageContentType.Command) {
        await this.runCommand(chat, message, recipient, locale);
        return;
      }
      if (message.content.type === MessageContentType.Audio) {
        const { mediaId, mimeType } = message.content;
        if (!mediaId || !mimeType) return;
        await this.sendTextMessage(
          recipient,
          MessageLoader.getMessage(
            MessageTemplate.ProcessingAudio,
            undefined,
            locale,
          ),
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
      }
      await this.runAiAgent(chat, message, recipient, onProgress);
    } catch (ex) {
      let text =
        ex instanceof AppError
          ? `⚠️ ${ex.message}\n${ex.action}`
          : MessageLoader.getMessage(
              MessageTemplate.UnexpectedError,
              undefined,
              locale,
            );
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
    recipient: string | SendMessageRecipientDTO,
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
    recipient: string | SendMessageRecipientDTO,
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

  async syncUserChatAddresses(dto: SyncUserChatAddressesDTO): Promise<void> {
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

  private async runCommand(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipientDTO,
    locale: MessageLocale,
  ): Promise<void> {
    if (
      sourceMessage.content.type !== MessageContentType.Command ||
      sourceMessage.content.name !== "effort"
    ) {
      throw new ValidationException("Unsupported chat command");
    }
    const supported = this.aiChatGateway.getSupportedReasoningEfforts();
    const requested = sourceMessage.content.arguments.level;
    let responseText: string;
    let reasoningEffortChanged = false;
    const previousReasoningEffort = chat.reasoningEffort;
    const supportedReasoningEfforts = supported.join(", ");
    if (requested === undefined) {
      responseText = MessageLoader.getMessage(
        MessageTemplate.EffortStatus,
        {
          reasoningEffort: chat.reasoningEffort,
          supportedReasoningEfforts,
        },
        locale,
      );
    } else if (
      !isReasoningEffort(requested) ||
      !supported.includes(requested)
    ) {
      responseText = MessageLoader.getMessage(
        MessageTemplate.EffortInvalid,
        {
          requestedReasoningEffort: requested,
          supportedReasoningEfforts,
        },
        locale,
      );
    } else {
      chat.setReasoningEffort(requested);
      reasoningEffortChanged = true;
      responseText = MessageLoader.getMessage(
        MessageTemplate.EffortUpdated,
        {
          reasoningEffort: requested,
        },
        locale,
      );
    }
    const responseMessage = chat.addAssistantTextMessage(responseText, {
      turnId: sourceMessage.turnId,
      audience: MessageAudience.Channel,
    });
    try {
      await this.database.transaction(async (sql) => {
        if (reasoningEffortChanged) await this.saveChat(chat, sql);
        await this.createMessage(responseMessage, sql);
      });
    } catch (error) {
      chat.messages.pop();
      if (reasoningEffortChanged) {
        chat.setReasoningEffort(previousReasoningEffort);
      }
      throw error;
    }
    const gateway = this.getMessagingGatewayByChannel(recipient.channel);
    await gateway.sendTextMessage({
      toAddress: recipient.toAddress,
      text: responseText,
    });
  }

  private async runAiAgent(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipientDTO,
    onProgress?: ChatResponseProgressListener,
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
        sourceMessage.turnId,
      );
      const response = await this.aiChatGateway.complete(
        {
          channelAddress: recipient.toAddress,
          messages: contextMessages,
          tools,
          reasoningEffort: chat.reasoningEffort,
          memory: chat.summary,
        },
        (progress) => {
          if (progress.type === "reasoningDelta") {
            onProgress?.({
              ...progress,
              round: round + 1,
            });
            return;
          }
          onProgress?.({
            type: "toolCall",
            round: round + 1,
            contentIndex: progress.contentIndex,
            callId: progress.call.callId,
            name: progress.call.name,
            arguments: progress.call.arguments,
          });
        },
      );
      const toolCalls = response.items.filter(
        (item) => item.type === MessageContentType.ToolCall,
      );
      for (const call of toolCalls) {
        const existing = chat.getToolCall(sourceMessage.turnId, call.callId);
        if (existing) {
          if (
            existing.content.type !== MessageContentType.ToolCall ||
            existing.content.name !== call.name ||
            JSON.stringify(existing.content.arguments) !==
              JSON.stringify(call.arguments) ||
            existing.content.thoughtSignature !== call.thoughtSignature
          ) {
            throw new ValidationException(
              "A tool call ID was reused with different arguments",
            );
          }
        }
      }
      const generation = chat.addGeneration({
        turnId: sourceMessage.turnId,
        provider: response.provider,
        model: response.model,
        api: response.api,
        responseModel: response.responseModel,
        responseId: response.responseId,
        reasoningEffort: chat.reasoningEffort,
        finishReason: response.finishReason,
        usage: response.usage,
        diagnostics: response.diagnostics,
      });
      const previousMessageCount = chat.messages.length;
      const generationMessages: Message[] = [];
      let audience: MessageAudience = MessageAudience.Both;
      if (toolCalls.length > 0) audience = MessageAudience.Model;
      for (const item of response.items) {
        let generatedMessage: Message | undefined;
        if (item.type === MessageContentType.Reasoning) {
          generatedMessage = chat.addAssistantReasoningMessage(
            sourceMessage.turnId,
            generation.id,
            item.text,
            {
              thinkingSignature: item.thinkingSignature,
              redacted: item.redacted,
            },
          );
        } else if (item.type === MessageContentType.ToolCall) {
          if (!chat.getToolCall(sourceMessage.turnId, item.callId)) {
            generatedMessage = chat.addAssistantToolCall(
              sourceMessage.turnId,
              generation.id,
              item,
            );
          }
        } else if (item.type === MessageContentType.Button) {
          generatedMessage = chat.addAssistantButtonMessage(
            item.text,
            item.options ?? [],
            {
              turnId: sourceMessage.turnId,
              audience,
              generationId: generation.id,
            },
          );
        } else {
          generatedMessage = chat.addAssistantTextMessage(item.text, {
            turnId: sourceMessage.turnId,
            audience,
            generationId: generation.id,
            textSignature: item.textSignature,
          });
        }
        if (generatedMessage) generationMessages.push(generatedMessage);
      }
      try {
        await this.database.transaction(async (sql) => {
          await this.createAiGeneration(generation, sql);
          for (const message of generationMessages) {
            await this.createMessage(message, sql);
          }
        });
      } catch (error) {
        chat.generations.pop();
        chat.messages.splice(previousMessageCount);
        throw error;
      }
      if (toolCalls.length === 0) {
        const channelMessages = generationMessages.filter(
          (message) => message.isChannelVisible,
        );
        if (channelMessages.length === 0) {
          throw new ValidationException(
            "The AI returned no channel-visible response",
          );
        }
        await this.deliverGeneratedMessages(recipient, channelMessages);
        return;
      }
      for (const call of toolCalls) {
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
        onProgress?.({
          type: "toolResult",
          round: round + 1,
          callId: call.callId,
          name: call.name,
          outcome: result.outcome,
        });
      }
    }
    await this.sendTextMessage(
      recipient,
      MessageLoader.getMessage(MessageTemplate.ToolRoundsExceeded),
      chat,
      { turnId: sourceMessage.turnId },
    );
  }

  private async deliverGeneratedMessages(
    recipient: SendMessageRecipientDTO,
    messages: Message[],
  ): Promise<void> {
    const gateway = this.getMessagingGatewayByChannel(recipient.channel);
    for (const message of messages) {
      if (message.content.type === MessageContentType.Button) {
        await gateway.sendInteractiveReplyButtonMessage({
          toAddress: recipient.toAddress,
          text: message.content.text,
          buttons: [...(message.content.options ?? [])],
        });
      } else if (message.content.type === MessageContentType.Text) {
        await gateway.sendTextMessage({
          toAddress: recipient.toAddress,
          text: message.content.text,
        });
      }
    }
  }

  private async buildModelContext(
    chat: Chat,
    channelAddress: string,
    tools: AiToolDefinitionDTO[],
    reasoningTurnId: string,
  ): Promise<AiChatContextMessageDTO[]> {
    const inputBudget =
      this.aiChatGateway.getContextWindowTokens() -
      this.aiConfig.maxOutputTokens -
      this.aiConfig.safetyMarginTokens;
    for (let attempt = 0; attempt <= chat.messages.length + 1; attempt++) {
      const messages = this.toAiContextMessages(
        chat,
        chat.getModelMessages(reasoningTurnId),
      );
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
      this.toAiContextMessages(chat, messages),
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

  private toAiContextMessages(
    chat: Chat,
    messages: Message[],
  ): AiChatContextMessageDTO[] {
    const generationsById = new Map(
      chat.generations.map((generation) => [generation.id, generation]),
    );
    return messages.map((message) => {
      const contextMessage: AiChatContextMessageDTO = {
        role: message.role,
        content: message.content,
        timestamp: message.createdAt.getTime(),
      };
      if (!message.generationId) return contextMessage;
      const generation = generationsById.get(message.generationId);
      if (!generation) {
        throw new ValidationException(
          "A message references an AI generation that does not exist",
        );
      }
      contextMessage.generation = {
        id: generation.id,
        provider: generation.provider,
        model: generation.model,
        api: generation.api,
        responseModel: generation.responseModel,
        responseId: generation.responseId,
        finishReason: generation.finishReason,
        usage: generation.usage,
        diagnostics: generation.diagnostics,
        timestamp: generation.createdAt.getTime(),
      };
      return contextMessage;
    });
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
    const loginUrl = await this.authService.getAppLoginUrl(
      receiveMessage.fromAddress,
    );
    await this.sendTextMessage(
      { channel: ChatChannel.WhatsApp, toAddress: receiveMessage.fromAddress },
      MessageLoader.getMessage(MessageTemplate.ThankYou, {
        loginUrl,
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
        generationId: dbMessage.generation_id ?? undefined,
        channelMessageId: dbMessage.channel_message_id ?? undefined,
        createdAt: dbMessage.created_at,
        updatedAt: dbMessage.updated_at,
      }),
    );
    const dbGenerations = await this.database.sql<DbAiGeneration[]>`
      SELECT * FROM ai_generations
      WHERE id_chat = ${dbChat.id}
      ORDER BY sequence ASC
    `;
    const generations = dbGenerations.map((dbGeneration) => {
      let usage: AiGeneration["usage"];
      if (dbGeneration.usage) {
        usage = this.parseJsonColumn(dbGeneration.usage);
      }
      let diagnostics: AiGeneration["diagnostics"];
      if (dbGeneration.diagnostics) {
        diagnostics = this.parseJsonColumn(dbGeneration.diagnostics);
      }
      return AiGeneration.restore({
        id: dbGeneration.id,
        idChat: dbGeneration.id_chat,
        turnId: dbGeneration.turn_id,
        sequence: Number(dbGeneration.sequence),
        provider: dbGeneration.provider ?? undefined,
        model: dbGeneration.model ?? undefined,
        api: dbGeneration.api ?? undefined,
        responseModel: dbGeneration.response_model ?? undefined,
        responseId: dbGeneration.response_id ?? undefined,
        reasoningEffort: dbGeneration.reasoning_effort,
        finishReason: dbGeneration.finish_reason,
        usage,
        diagnostics,
        createdAt: dbGeneration.created_at,
      });
    });
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
      generations,
      reasoningEffort: dbChat.reasoning_effort,
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
        reasoning_effort,
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
        ${chat.reasoningEffort},
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
        generation_id,
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
        ${message.generationId ?? null},
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

  private async createAiGeneration(
    generation: AiGeneration,
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<void> {
    let usage: ReturnType<DatabaseGateway["json"]> | null = null;
    if (generation.usage) usage = this.database.json(generation.usage);
    let diagnostics: ReturnType<DatabaseGateway["json"]> | null = null;
    if (generation.diagnostics) {
      diagnostics = this.database.json(generation.diagnostics);
    }
    const result = await sql<{ sequence: string }[]>`
      INSERT INTO ai_generations (
        id,
        id_chat,
        turn_id,
        provider,
        model,
        api,
        response_model,
        response_id,
        reasoning_effort,
        finish_reason,
        usage,
        diagnostics,
        created_at
      )
      VALUES (
        ${generation.id},
        ${generation.idChat},
        ${generation.turnId},
        ${generation.provider ?? null},
        ${generation.model ?? null},
        ${generation.api ?? null},
        ${generation.responseModel ?? null},
        ${generation.responseId ?? null},
        ${generation.reasoningEffort},
        ${generation.finishReason},
        ${usage},
        ${diagnostics},
        ${generation.createdAt}
      )
      RETURNING sequence
    `;
    const inserted = result[0];
    if (!inserted) {
      throw new ValidationException("AI generation could not be persisted");
    }
    generation.sequence = Number(inserted.sequence);
  }

  private async saveMessage(message: Message): Promise<void> {
    await this.database.sql`
      UPDATE messages SET
        content = ${this.database.json(message.content)},
        updated_at = ${message.updatedAt}
      WHERE id = ${message.id}
    `;
  }

  private async saveChatChannelAddress(chat: Chat): Promise<void> {
    if (chat.channel === ChatChannel.WhatsApp) {
      await this.database.sql`
        UPDATE chats SET
          channel = ${chat.channel},
          whatsapp_address = ${chat.whatsAppAddress ?? null},
          updated_at = ${chat.updatedAt}
        WHERE id = ${chat.id}
      `;
      return;
    }
    await this.database.sql`
      UPDATE chats SET
        channel = ${chat.channel},
        web_address = ${chat.webAddress ?? null},
        updated_at = ${chat.updatedAt}
      WHERE id = ${chat.id}
    `;
  }

  private async saveChat(
    chat: Chat,
    sql: DatabaseGateway["sql"] = this.database.sql,
  ): Promise<void> {
    await sql`
      UPDATE chats SET
        id_user = ${chat.idUser ?? null},
        channel = ${chat.channel},
        whatsapp_address = ${chat.whatsAppAddress ?? null},
        web_address = ${chat.webAddress ?? null},
        reasoning_effort = ${chat.reasoningEffort},
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
  whatsapp_address: string | null;
  web_address: string | null;
  channel: string;
  reasoning_effort: ReasoningEffort;
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
  generation_id: string | null;
  channel_message_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DbAiGeneration {
  id: string;
  id_chat: string;
  turn_id: string;
  sequence: string;
  provider: string | null;
  model: string | null;
  api: string | null;
  response_model: string | null;
  response_id: string | null;
  reasoning_effort: ReasoningEffort;
  finish_reason: string;
  usage: unknown;
  diagnostics: unknown;
  created_at: Date;
}
