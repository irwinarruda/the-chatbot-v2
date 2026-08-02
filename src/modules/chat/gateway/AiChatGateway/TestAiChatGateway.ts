import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import {
  type ReasoningEffort,
  reasoningEfforts,
} from "~/modules/chat/entities/enums/ReasoningEffort";
import type {
  AiChatContextMessageDTO,
  AiChatGateway,
  AiCompletionProgressDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiModelSelectionDTO,
  AiSummaryCandidateDTO,
  AssistantGenerationContentDTO,
  TestAiScriptedResponseDTO,
} from "~/modules/chat/gateway/AiChatGateway";

export class TestAiChatGateway implements AiChatGateway {
  lastChannelAddress?: string;
  lastRequest?: AiCompletionRequestDTO;
  requests: AiCompletionRequestDTO[] = [];
  scriptedResponses: TestAiScriptedResponseDTO[] = [];
  scriptedTexts: string[] = [];
  generatedTextRequests: Array<{ systemPrompt: string; userText: string }> = [];
  summaryRequests: AiChatContextMessageDTO[][] = [];
  summaryError?: Error;
  summaryCalls = 0;
  contextWindowTokens = 1_000_000;
  maxOutputTokens = 131_072;
  supportedReasoningEfforts = [...reasoningEfforts];
  availableModels: AiModelSelectionDTO[] = [this.getDefaultModel()];
  supportedReasoningEffortsByModel = new Map<string, ReasoningEffort[]>();

  getDefaultModel(): AiModelSelectionDTO {
    return { provider: "test", model: "test-model" };
  }

  async getAvailableModels(_idUser: string): Promise<AiModelSelectionDTO[]> {
    return this.availableModels;
  }

  getContextWindowTokens(_model: AiModelSelectionDTO): number {
    return this.contextWindowTokens;
  }

  getMaxOutputTokens(_model: AiModelSelectionDTO): number {
    return this.maxOutputTokens;
  }

  getSupportedReasoningEfforts(model: AiModelSelectionDTO): ReasoningEffort[] {
    return (
      this.supportedReasoningEffortsByModel.get(
        `${model.provider}/${model.model}`,
      ) ?? this.supportedReasoningEfforts
    );
  }

  async complete(
    request: AiCompletionRequestDTO,
    onProgress?: (progress: AiCompletionProgressDTO) => void,
  ): Promise<AiCompletionResponseDTO> {
    this.lastChannelAddress = request.channelAddress;
    this.lastRequest = request;
    this.requests.push(request);
    const scripted = this.scriptedResponses.shift();
    if (scripted) {
      let items: AssistantGenerationContentDTO[];
      if (scripted.items) {
        items = scripted.items;
      } else {
        items = [...scripted.toolCalls];
        if (scripted.content) items.unshift(scripted.content);
      }
      for (const [contentIndex, item] of items.entries()) {
        if (item.type === MessageContentType.Reasoning) {
          onProgress?.({
            type: "reasoningDelta",
            contentIndex,
            delta: item.text,
          });
        } else if (item.type === MessageContentType.ToolCall) {
          onProgress?.({ type: "toolCall", contentIndex, call: item });
        }
      }
      return {
        provider: request.model.provider,
        model: request.model.model,
        api: "test-api",
        items,
        finishReason: scripted.finishReason,
        usage: this.emptyUsage(),
      };
    }
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === MessageRole.User);
    return {
      provider: request.model.provider,
      model: request.model.model,
      api: "test-api",
      items: [
        {
          type: MessageContentType.Text,
          text: `Response to: ${this.messageText(lastUserMessage).trim()}`,
        },
      ],
      finishReason: "stop",
      usage: this.emptyUsage(),
    };
  }

  estimateInputTokens(request: AiInputEstimateRequestDTO): number {
    return Math.ceil(JSON.stringify(request).length / 3);
  }

  async generateText(
    _idUser: string,
    _model: AiModelSelectionDTO,
    systemPrompt: string,
    userText: string,
  ): Promise<string> {
    this.generatedTextRequests.push({ systemPrompt, userText });
    return this.scriptedTexts.shift() ?? "";
  }

  async generateSummary(
    _idUser: string,
    _model: AiModelSelectionDTO,
    messages: AiChatContextMessageDTO[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidateDTO> {
    this.summaryCalls += 1;
    this.summaryRequests.push(messages);
    if (this.summaryError) throw this.summaryError;
    return {
      userProfile: [
        ...(existingSummary?.userProfile ?? []),
        `Summary of ${messages.length} messages`,
      ],
      durableFacts: existingSummary?.durableFacts ?? [],
    };
  }

  private messageText(message?: AiChatContextMessageDTO): string {
    if (!message) return "";
    const content = message.content;
    if (content.type === MessageContentType.Audio) {
      return content.transcript ?? "";
    }
    if (
      content.type === MessageContentType.Text ||
      content.type === MessageContentType.Button
    ) {
      return content.text;
    }
    return "";
  }

  private emptyUsage() {
    return {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    };
  }
}
