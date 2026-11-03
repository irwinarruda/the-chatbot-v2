import {
  createAiContextCompactionPolicy,
  selectCompactableTurns,
} from "~/domain/chat/ai-context-compaction-policy";
import type { Chat } from "~/domain/chat/chat";
import { ConversationSummary } from "~/domain/chat/conversation-summary";
import type { Message } from "~/domain/chat/message";
import { ValidationException } from "~/domain/shared/domain-errors";
import type {
  AiChatContextMessageDTO,
  AiChatGateway,
  AiModelSelectionDTO,
  AiToolDefinitionDTO,
} from "~/server/modules/chat/gateways/ai-chat";
import type { ChatRepository } from "~/server/modules/chat/repositories/chat.repository";
import { UnauthorizedException } from "~/server/shared/errors/application-errors";

const summaryInputRatio = 0.75;

export class ChatContextService {
  constructor(
    private chats: ChatRepository,
    private aiChatGateway: AiChatGateway,
  ) {}

  async build(
    chat: Chat,
    channelAddress: string,
    tools: AiToolDefinitionDTO[],
    reasoningTurnId: string,
    model: AiModelSelectionDTO,
  ): Promise<AiChatContextMessageDTO[]> {
    if (!chat.idUser) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    const idUser = chat.idUser;
    const policy = createAiContextCompactionPolicy(
      this.aiChatGateway.getContextWindowTokens(model),
      this.aiChatGateway.getMaxOutputTokens(model),
    );
    let messages = this.toAiContextMessages(
      chat,
      chat.getModelMessages(reasoningTurnId),
    );
    let requestTokens = this.estimateModelContext(
      idUser,
      model,
      channelAddress,
      messages,
      tools,
      chat.summary,
    );
    while (requestTokens > policy.triggerTokens) {
      const compactableTurns = selectCompactableTurns(
        chat.getUncompactedTurns(),
        policy.protectedRecentTurns,
      );
      if (compactableTurns.length === 0) break;
      try {
        const requiredTurns = this.selectTurnsForCompaction(
          chat,
          compactableTurns,
          reasoningTurnId,
          idUser,
          model,
          channelAddress,
          tools,
          policy.targetTokens,
        );
        const turns = this.limitSummaryBatch(
          chat,
          requiredTurns,
          idUser,
          model,
          channelAddress,
          Math.floor(policy.hardInputTokens * summaryInputRatio),
        );
        await this.compactChat(chat, turns, model);
      } catch (error) {
        if (requestTokens <= policy.hardInputTokens) return messages;
        throw error;
      }
      messages = this.toAiContextMessages(
        chat,
        chat.getModelMessages(reasoningTurnId),
      );
      requestTokens = this.estimateModelContext(
        idUser,
        model,
        channelAddress,
        messages,
        tools,
        chat.summary,
      );
    }
    if (requestTokens <= policy.hardInputTokens) return messages;
    throw new ValidationException(
      "The protected recent turns exceed the model context budget",
      "Choose a model with a larger context window.",
    );
  }

  async compactAll(
    chat: Chat,
    idUser: string,
    channelAddress: string,
    model: AiModelSelectionDTO,
  ): Promise<boolean> {
    const policy = createAiContextCompactionPolicy(
      this.aiChatGateway.getContextWindowTokens(model),
      this.aiChatGateway.getMaxOutputTokens(model),
    );
    let isCompacted = false;
    while (true) {
      const compactableTurns = selectCompactableTurns(
        chat.getUncompactedTurns(),
        policy.protectedRecentTurns,
      );
      if (compactableTurns.length === 0) break;
      const turns = this.limitSummaryBatch(
        chat,
        compactableTurns,
        idUser,
        model,
        channelAddress,
        Math.floor(policy.hardInputTokens * summaryInputRatio),
      );
      await this.compactChat(chat, turns, model);
      isCompacted = true;
    }
    return isCompacted;
  }

  private selectTurnsForCompaction(
    chat: Chat,
    compactableTurns: Message[][],
    reasoningTurnId: string,
    idUser: string,
    model: AiModelSelectionDTO,
    channelAddress: string,
    tools: AiToolDefinitionDTO[],
    targetTokens: number,
  ): Message[][] {
    const modelMessages = chat.getModelMessages(reasoningTurnId);
    let first = 0;
    let last = compactableTurns.length - 1;
    let selectedCount = compactableTurns.length;
    while (first <= last) {
      const middle = Math.floor((first + last) / 2);
      const turn = compactableTurns[middle];
      const cursor = turn?.[turn.length - 1]?.sequence;
      if (cursor === undefined) {
        throw new ValidationException(
          "Cannot compact messages without a persisted sequence",
        );
      }
      const remaining = this.toAiContextMessages(
        chat,
        modelMessages.filter(
          (message) =>
            message.sequence === undefined || message.sequence > cursor,
        ),
      );
      const estimate = this.estimateModelContext(
        idUser,
        model,
        channelAddress,
        remaining,
        tools,
        chat.summary,
      );
      if (estimate <= targetTokens) {
        selectedCount = middle + 1;
        last = middle - 1;
      } else {
        first = middle + 1;
      }
    }
    return compactableTurns.slice(0, selectedCount);
  }

  private limitSummaryBatch(
    chat: Chat,
    turns: Message[][],
    idUser: string,
    model: AiModelSelectionDTO,
    channelAddress: string,
    summaryInputTokens: number,
  ): Message[][] {
    let first = 0;
    let last = turns.length - 1;
    let selectedCount = 0;
    while (first <= last) {
      const middle = Math.floor((first + last) / 2);
      const messages = this.toAiContextMessages(
        chat,
        turns.slice(0, middle + 1).flat(),
      );
      const estimate = this.estimateModelContext(
        idUser,
        model,
        channelAddress,
        messages,
        [],
        chat.summary,
      );
      if (estimate <= summaryInputTokens) {
        selectedCount = middle + 1;
        first = middle + 1;
      } else {
        last = middle - 1;
      }
    }
    if (selectedCount === 0) {
      throw new ValidationException(
        "A completed turn is too large to compact safely",
        "Choose a model with a larger context window.",
      );
    }
    return turns.slice(0, selectedCount);
  }

  private estimateModelContext(
    idUser: string,
    model: AiModelSelectionDTO,
    channelAddress: string,
    messages: AiChatContextMessageDTO[],
    tools: AiToolDefinitionDTO[],
    memory?: ConversationSummary,
  ): number {
    return this.aiChatGateway.estimateInputTokens({
      idUser,
      model,
      channelAddress,
      messages,
      tools,
      memory,
    });
  }

  private async compactChat(
    chat: Chat,
    turns: Message[][],
    model: AiModelSelectionDTO,
  ): Promise<void> {
    if (!chat.idUser) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    const idUser = chat.idUser;
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
      idUser,
      model,
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
      await this.chats.saveSummary(chat, previousSummary);
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
}
