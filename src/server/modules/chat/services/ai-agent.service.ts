import type { ChatResponseProgressEventDTO } from "~/contracts/http/chat/chat";
import type { Chat } from "~/domain/chat/chat";
import type { Message } from "~/domain/chat/message";
import { MessageAudience } from "~/domain/chat/message-audience";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { AiChatGateway } from "~/server/modules/chat/gateways/ai-chat";
import type { SendMessageRecipientDTO } from "~/server/modules/chat/gateways/messaging";
import type { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import type { AiModelService } from "~/server/modules/chat/services/ai-model.service";
import type { ChatContextService } from "~/server/modules/chat/services/chat-context.service";
import type { ChatDeliveryService } from "~/server/modules/chat/services/chat-delivery.service";
import type { ToolExecutor } from "~/server/modules/chat/services/tool-executor.service";
import {
  MessageLoader,
  MessageTemplate,
} from "~/server/modules/chat/utils/message-loader";
import type { DatabaseGateway } from "~/server/shared/database/database";
import { UnauthorizedException } from "~/server/shared/errors/application-errors";

export type ChatResponseProgressListener = (
  event: ChatResponseProgressEventDTO,
) => void;

const maximumToolRounds = 9;

export class AiAgentService {
  constructor(
    private database: DatabaseGateway,
    private chats: ChatRepository,
    private delivery: ChatDeliveryService,
    private context: ChatContextService,
    private aiModelService: AiModelService,
    private aiChatGateway: AiChatGateway,
    private tools: ToolExecutor,
  ) {}

  async run(
    chat: Chat,
    sourceMessage: Message,
    recipient: SendMessageRecipientDTO,
    onProgress?: ChatResponseProgressListener,
  ): Promise<void> {
    if (!chat.idUser) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    const runtimeModel = await this.aiModelService.getForUser(chat.idUser);
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
      await this.chats.createMessage(result);
    }
    const tools = this.tools.getDefinitions();
    for (let round = 0; round < maximumToolRounds; round++) {
      const contextMessages = await this.context.build(
        chat,
        recipient.toAddress,
        tools,
        sourceMessage.turnId,
        runtimeModel,
      );
      const response = await this.aiChatGateway.complete(
        {
          idUser: chat.idUser,
          model: runtimeModel,
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
          await this.chats.createGeneration(generation, sql);
          for (const message of generationMessages) {
            await this.chats.createMessage(message, sql);
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
        await this.delivery.deliverGenerated(recipient, channelMessages);
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
        const result = await this.tools.execute(call, {
          chat,
          sourceMessage,
          model: runtimeModel,
        });
        const resultMessage = chat.addToolResult(sourceMessage.turnId, result);
        await this.chats.createMessage(resultMessage);
        onProgress?.({
          type: "toolResult",
          round: round + 1,
          callId: call.callId,
          name: call.name,
          outcome: result.outcome,
        });
      }
    }
    await this.delivery.sendTextMessage(
      recipient,
      MessageLoader.getMessage(MessageTemplate.ToolRoundsExceeded),
      chat,
      { turnId: sourceMessage.turnId },
    );
  }
}
