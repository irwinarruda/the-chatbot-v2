import type { Chat } from "~/domain/chat/chat";
import type { Message } from "~/domain/chat/message";
import { MessageAudience } from "~/domain/chat/message-audience";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { MessageLocale } from "~/domain/chat/message-locale";
import { isReasoningEffort } from "~/domain/chat/reasoning-effort";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { AiChatGateway } from "~/server/modules/chat/gateways/ai-chat";
import type { SendMessageRecipientDTO } from "~/server/modules/chat/gateways/messaging";
import type { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import type { AiModelService } from "~/server/modules/chat/services/ai-model.service";
import type { ChatContextService } from "~/server/modules/chat/services/chat-context.service";
import type { ChatDeliveryService } from "~/server/modules/chat/services/chat-delivery.service";
import {
  MessageLoader,
  MessageTemplate,
} from "~/server/modules/chat/utils/message-loader";
import type { DatabaseGateway } from "~/server/shared/database/database";

export class ChatCommandService {
  constructor(
    private database: DatabaseGateway,
    private chats: ChatRepository,
    private delivery: ChatDeliveryService,
    private context: ChatContextService,
    private aiModelService: AiModelService,
    private aiChatGateway: AiChatGateway,
  ) {}

  async run(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipientDTO,
    locale: MessageLocale,
  ): Promise<void> {
    if (sourceMessage.content.type !== MessageContentType.Command) {
      throw new ValidationException("Unsupported chat command");
    }
    if (sourceMessage.content.name === "model") {
      await this.runModelCommand(chat, sourceMessage, recipient, locale);
      return;
    }
    if (sourceMessage.content.name === "compact") {
      await this.runCompactCommand(chat, sourceMessage, recipient, locale);
      return;
    }
    if (sourceMessage.content.name !== "effort" || !chat.idUser) {
      throw new ValidationException("Unsupported chat command");
    }
    const model = await this.aiModelService.getForUser(chat.idUser);
    const supported = this.aiChatGateway.getSupportedReasoningEfforts(model);
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
        if (reasoningEffortChanged) await this.chats.save(chat, sql);
        await this.chats.createMessage(responseMessage, sql);
      });
    } catch (error) {
      chat.messages.pop();
      if (reasoningEffortChanged) {
        chat.setReasoningEffort(previousReasoningEffort);
      }
      throw error;
    }
    await this.delivery.sendPersisted(recipient, responseText);
  }

  private async runCompactCommand(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipientDTO,
    locale: MessageLocale,
  ): Promise<void> {
    if (
      sourceMessage.content.type !== MessageContentType.Command ||
      sourceMessage.content.name !== "compact" ||
      !chat.idUser
    ) {
      throw new ValidationException("Unsupported chat command");
    }
    const model = await this.aiModelService.getForUser(chat.idUser);
    const compacted = await this.context.compactAll(
      chat,
      chat.idUser,
      recipient.toAddress,
      model,
    );
    let template: MessageTemplate = MessageTemplate.CompactUnavailable;
    if (compacted) template = MessageTemplate.CompactCompleted;
    const responseText = MessageLoader.getMessage(template, undefined, locale);
    await this.delivery.sendTextMessage(recipient, responseText, chat, {
      turnId: sourceMessage.turnId,
      audience: MessageAudience.Channel,
    });
  }

  private async runModelCommand(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipientDTO,
    locale: MessageLocale,
  ): Promise<void> {
    if (
      sourceMessage.content.type !== MessageContentType.Command ||
      sourceMessage.content.name !== "model" ||
      !chat.idUser
    ) {
      throw new ValidationException("Unsupported chat command");
    }
    const idUser = chat.idUser;
    const activeModel = await this.aiModelService.getForUser(idUser);
    const availableModels =
      await this.aiModelService.getAvailableForUser(idUser);
    const availableIds = [
      ...new Set(availableModels.map((model) => model.model)),
    ].join(", ");
    let availableModelIds = availableIds;
    if (!availableModelIds) {
      availableModelIds = "nenhum";
      if (locale === MessageLocale.En) availableModelIds = "none";
    }
    const requestedModel = sourceMessage.content.arguments.model;
    let selectedModel = activeModel;
    let responseText: string;
    let shouldSave = false;
    let effortReset = false;
    const previousReasoningEffort = chat.reasoningEffort;
    if (requestedModel === undefined) {
      responseText = MessageLoader.getMessage(
        MessageTemplate.ModelStatus,
        {
          activeModelId: activeModel.model,
          availableModelIds,
        },
        locale,
      );
    } else {
      const candidates = availableModels.filter(
        (model) => model.model === requestedModel,
      );
      const candidate = candidates.length === 1 ? candidates[0] : undefined;
      if (!candidate) {
        responseText = MessageLoader.getMessage(
          MessageTemplate.ModelInvalid,
          {
            activeModelId: activeModel.model,
            availableModelIds,
            requestedModelId: requestedModel,
          },
          locale,
        );
      } else {
        selectedModel = candidate;
        shouldSave = true;
        const supported =
          this.aiChatGateway.getSupportedReasoningEfforts(selectedModel);
        if (!supported.includes(chat.reasoningEffort)) {
          const fallbackEffort = supported[0];
          if (!fallbackEffort) {
            throw new ValidationException(
              `Model ${selectedModel.model} has no supported reasoning effort`,
            );
          }
          chat.setReasoningEffort(fallbackEffort);
          effortReset = true;
        }
        let effortResetNote = "";
        if (effortReset) {
          effortResetNote = `O nível de raciocínio foi redefinido para ${chat.reasoningEffort} para este modelo.`;
          if (locale === MessageLocale.En) {
            effortResetNote = `Reasoning effort was reset to ${chat.reasoningEffort} for this model.`;
          }
        }
        responseText = MessageLoader.getMessage(
          MessageTemplate.ModelUpdated,
          {
            activeModelId: selectedModel.model,
            effortResetNote,
          },
          locale,
        );
      }
    }
    const responseMessage = chat.addAssistantTextMessage(responseText, {
      turnId: sourceMessage.turnId,
      audience: MessageAudience.Channel,
    });
    try {
      await this.database.transaction(async (sql) => {
        if (shouldSave) {
          await this.aiModelService.saveForUser(idUser, selectedModel, sql);
        }
        if (effortReset) await this.chats.save(chat, sql);
        await this.chats.createMessage(responseMessage, sql);
      });
    } catch (error) {
      chat.messages.pop();
      if (effortReset) chat.setReasoningEffort(previousReasoningEffort);
      throw error;
    }
    await this.delivery.sendPersisted(recipient, responseText);
  }
}
