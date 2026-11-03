import { v4 as uuidv4 } from "uuid";
import { Chat } from "~/domain/chat/chat";
import { ChatChannel } from "~/domain/chat/chat-channel";
import { parseChatCommand } from "~/domain/chat/chat-command";
import type { Message } from "~/domain/chat/message";
import { MessageAudience } from "~/domain/chat/message-audience";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { MessageLocale } from "~/domain/chat/message-locale";
import type { ReasoningEffort } from "~/domain/chat/reasoning-effort";
import { PhoneNumberUtils } from "~/domain/identity/phone-number";
import { ValidationException } from "~/domain/shared/domain-errors";
import type {
  AiChatGateway,
  AiModelConfigurationDTO,
  AiModelSelectionDTO,
} from "~/server/modules/chat/gateways/ai-chat";
import type {
  ReceiveMessageDTO,
  SendMessageRecipientDTO,
} from "~/server/modules/chat/gateways/messaging";
import type { SpeechToTextGateway } from "~/server/modules/chat/gateways/speech-to-text";
import type { StorageGateway } from "~/server/modules/chat/gateways/storage";
import type { WebMessagingGateway } from "~/server/modules/chat/gateways/web-messaging";
import type { WhatsAppMessagingGateway } from "~/server/modules/chat/gateways/whatsapp-messaging";
import type { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import type {
  AiAgentService,
  ChatResponseProgressListener,
} from "~/server/modules/chat/services/ai-agent.service";
import type { AiModelService } from "~/server/modules/chat/services/ai-model.service";
import type { ChatCommandService } from "~/server/modules/chat/services/chat-command.service";
import type { ChatDeliveryService } from "~/server/modules/chat/services/chat-delivery.service";
import { audioExtensionFor } from "~/server/modules/chat/utils/audio-extension";
import {
  MessageLoader,
  MessageTemplate,
} from "~/server/modules/chat/utils/message-loader";
import type { AuthService } from "~/server/modules/identity/services/auth.service";
import type { DatabaseGateway } from "~/server/shared/database/database";
import {
  AppError,
  UnauthorizedException,
} from "~/server/shared/errors/application-errors";

export class MessagingService {
  constructor(
    private database: DatabaseGateway,
    private chats: ChatRepository,
    private delivery: ChatDeliveryService,
    private commands: ChatCommandService,
    private agent: AiAgentService,
    private authService: AuthService,
    private whatsAppMessagingGateway: WhatsAppMessagingGateway,
    private webMessagingGateway: WebMessagingGateway,
    private aiChatGateway: AiChatGateway,
    private aiModelService: AiModelService,
    private storageGateway: StorageGateway,
    private speechToTextGateway: SpeechToTextGateway,
    private isDevelopment: boolean,
  ) {}

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

  async getSupportedReasoningEfforts(
    idUser?: string,
  ): Promise<ReasoningEffort[]> {
    return (await this.getModelConfiguration(idUser)).supportedReasoningEfforts;
  }

  async getModelConfiguration(
    idUser?: string,
  ): Promise<AiModelConfigurationDTO> {
    let currentModel: AiModelSelectionDTO;
    let availableModels: AiModelSelectionDTO[];
    if (idUser) {
      currentModel = await this.aiModelService.getForUser(idUser);
      availableModels = await this.aiModelService.getAvailableForUser(idUser);
    } else {
      currentModel = this.aiChatGateway.getDefaultModel();
      availableModels = [currentModel];
    }
    return {
      currentModel,
      availableModels,
      supportedReasoningEfforts:
        this.aiChatGateway.getSupportedReasoningEfforts(currentModel),
    };
  }

  async listenToMessage(
    receiveMessage: ReceiveMessageDTO,
    onProgress?: ChatResponseProgressListener,
    locale: MessageLocale = MessageLocale.PtBr,
  ): Promise<void> {
    const { channelMessageId } = receiveMessage;
    if (await this.chats.hasChannelMessage(channelMessageId)) return;
    if (!(await this.isAllowedSender(receiveMessage))) return;
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
      await this.chats.saveChannelAddress(chat);
    }
    let message: Message;
    if ("text" in receiveMessage) {
      const command = parseChatCommand(receiveMessage.text);
      if (command) {
        message = chat.addUserCommandMessage(
          command.raw,
          command.name,
          command.arguments,
          receiveMessage.channelMessageId,
        );
      } else {
        message = chat.addUserTextMessage(
          receiveMessage.text,
          receiveMessage.channelMessageId,
        );
      }
    } else if ("buttonReply" in receiveMessage) {
      message = chat.addUserButtonMessage(
        receiveMessage.buttonReply,
        receiveMessage.channelMessageId,
      );
    } else if ("mediaId" in receiveMessage) {
      message = chat.addUserAudioMessage(
        receiveMessage.mediaId,
        receiveMessage.mimeType,
        receiveMessage.channelMessageId,
      );
    } else {
      message = chat.addUserTextMessage("", channelMessageId);
    }
    const created = isNewChat
      ? await this.database.transaction(async (sql) => {
          await this.chats.create(chat, sql);
          return this.chats.createMessage(message, sql);
        })
      : await this.chats.createMessage(message);
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
      await this.chats.save(chat);
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
        await this.commands.run(chat, message, recipient, locale);
        return;
      }
      if (message.content.type === MessageContentType.Audio) {
        const { mediaId, mimeType } = message.content;
        if (!mediaId || !mimeType) return;
        await this.delivery.sendTextMessage(
          recipient,
          MessageLoader.getMessage(
            MessageTemplate.ProcessingAudio,
            undefined,
            locale,
          ),
          chat,
          { turnId: message.turnId, audience: MessageAudience.Channel },
        );
        const gateway = this.delivery.gatewayFor(recipient.channel);
        const mediaContent = await gateway.downloadMediaAsync(mediaId);
        const baseMimeType = mimeType.split(";")[0].trim().toLowerCase();
        const key = `audio/${chat.id}/${uuidv4()}${audioExtensionFor(baseMimeType)}`;
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
        await this.chats.saveMessage(message);
      }
      await this.agent.run(chat, message, recipient, onProgress);
    } catch (ex) {
      let text =
        ex instanceof AppError
          ? `⚠️ ${ex.message}\n${ex.action}`
          : MessageLoader.getMessage(
              MessageTemplate.UnexpectedError,
              undefined,
              locale,
            );
      if (this.isDevelopment) {
        const detail =
          ex instanceof Error
            ? `${ex.message}${ex.stack ? `\n${ex.stack}` : ""}`
            : String(ex);
        text = `${text}\n\n${detail}`;
      }
      await this.delivery.sendTextMessage(recipient, text, chat, {
        turnId: message.turnId,
        audience: MessageAudience.Both,
      });
    }
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
    return this.chats.findByChannelAddress(channelAddress, channel);
  }

  async getChatByPhoneNumber(phoneNumber: string): Promise<Chat | undefined> {
    return this.getChatByChannelAddress(
      PhoneNumberUtils.addDigitNine(phoneNumber),
      ChatChannel.WhatsApp,
    );
  }

  private async isAllowedSender(
    receiveMessage: ReceiveMessageDTO,
  ): Promise<boolean> {
    if (receiveMessage.channel === ChatChannel.Web) return true;
    return this.chats.isAllowlisted(
      receiveMessage.channel,
      receiveMessage.fromAddress,
    );
  }

  private async sendLoginMessage(
    chat: Chat,
    receiveMessage: ReceiveMessageDTO,
  ): Promise<void> {
    const loginUrl = await this.authService.getAppLoginUrl(
      receiveMessage.fromAddress,
    );
    await this.delivery.sendTextMessage(
      { channel: ChatChannel.WhatsApp, toAddress: receiveMessage.fromAddress },
      MessageLoader.getMessage(MessageTemplate.ThankYou, {
        loginUrl,
      }),
      chat,
    );
  }
}
