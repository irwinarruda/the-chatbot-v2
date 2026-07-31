import {
  createModels,
  getSupportedThinkingLevels,
  type Model,
  type MutableModels,
  type SimpleStreamOptions,
  Type,
} from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { zaiProvider } from "@earendil-works/pi-ai/providers/zai";
import { z } from "zod";
import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import {
  ReplyWithOptionsToolDTO,
  replyWithOptionsToolName,
} from "~/modules/chat/entities/dtos/ReplyWithOptionsToolDTO";
import {
  ReasoningEffort,
  type ReasoningEffort as ReasoningEffortType,
} from "~/modules/chat/entities/enums/ReasoningEffort";
import type {
  AiChatContextMessageDTO,
  AiChatGateway,
  AiCompletionProgressDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiSummaryCandidateDTO,
  AiToolDefinitionDTO,
} from "~/modules/chat/gateway/AiChatGateway";
import { mapPiAssistantProgress } from "~/modules/chat/gateway/AiChatGateway/mapPiAssistantProgress";
import { mapPiAssistantResponse } from "~/modules/chat/gateway/AiChatGateway/mapPiAssistantResponse";
import { PiMessageMapper } from "~/modules/chat/gateway/AiChatGateway/PiMessageMapper";
import { PromptLoader, PromptLocale } from "~/modules/chat/utils/PromptLoader";
import type { AiConfig } from "~/shared/config/Config";
import { ValidationException } from "~/shared/errors/DomainErrors";

const summaryCandidateSchema = z.object({
  userProfile: z.array(z.string()),
  durableFacts: z.array(z.string()),
});

const replyWithOptionsTool: AiToolDefinitionDTO = {
  name: replyWithOptionsToolName,
  description: [
    "Send the final user-visible assistant message with 1 to 3 selectable options.",
    "Use this instead of writing choices in a text response.",
    "This response is terminal: do not include text or call another tool in the same response.",
  ].join("\n"),
  inputSchema: ReplyWithOptionsToolDTO,
};

export class PiAiChatGateway implements AiChatGateway {
  private models: MutableModels;
  private model: Model<any>;

  constructor(private config: AiConfig) {
    this.models = createModels();
    const provider = this.createProvider();
    this.models.setProvider(provider);
    const model = this.models.getModel(provider.id, config.model);
    if (!model) {
      throw new ValidationException(
        `Model ${config.model} is not available for provider ${provider.id}`,
      );
    }
    this.model = { ...model, maxTokens: config.maxOutputTokens };
  }

  private createProvider() {
    if (this.config.provider === "openai") return openaiProvider();
    if (this.config.provider === "anthropic") return anthropicProvider();
    return zaiProvider();
  }

  getContextWindowTokens(): number {
    return this.model.contextWindow;
  }

  getSupportedReasoningEfforts(): ReasoningEffortType[] {
    const levels = getSupportedThinkingLevels(
      this.model,
    ) as ReasoningEffortType[];
    const preferredLevels = new Map<string, ReasoningEffortType>();
    for (const level of levels) {
      const providerLevel = this.getProviderReasoningLevel(level);
      const preferred = preferredLevels.get(providerLevel);
      if (!preferred || providerLevel === level) {
        preferredLevels.set(providerLevel, level);
      }
    }
    return levels.filter(
      (level) =>
        preferredLevels.get(this.getProviderReasoningLevel(level)) === level,
    );
  }

  async complete(
    request: AiCompletionRequestDTO,
    onProgress?: (progress: AiCompletionProgressDTO) => void,
  ): Promise<AiCompletionResponseDTO> {
    const systemPrompt = this.buildSystemPrompt(
      request.channelAddress,
      request.memory,
    );
    const options: SimpleStreamOptions = {
      apiKey: this.config.apiKey,
      maxTokens: this.config.maxOutputTokens,
    };
    if (request.reasoningEffort !== ReasoningEffort.Off) {
      options.reasoning = request.reasoningEffort;
    }
    const stream = this.models.streamSimple(
      this.model,
      {
        systemPrompt,
        messages: PiMessageMapper.map(request.messages, this.model),
        tools: this.getToolDefinitions(request.tools).map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: Type.Unsafe(this.toJsonSchema(tool)),
        })),
      },
      options,
    );
    for await (const event of stream) {
      const progress = mapPiAssistantProgress(event);
      if (progress) onProgress?.(progress);
    }
    const response = await stream.result();
    if (response.stopReason === "error" || response.stopReason === "aborted") {
      throw new Error(response.errorMessage ?? "The AI returned no response");
    }
    const mapped = mapPiAssistantResponse(response);
    return {
      ...mapped,
      provider: response.provider,
      model: response.model,
      api: response.api,
      responseModel: response.responseModel,
      responseId: response.responseId,
      finishReason: response.stopReason,
      usage: response.usage,
      diagnostics: response.diagnostics,
    };
  }

  estimateInputTokens(request: AiInputEstimateRequestDTO): number {
    const systemPrompt = this.buildSystemPrompt(
      request.channelAddress,
      request.memory,
    );
    const tools = this.getToolDefinitions(request.tools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.toJsonSchema(tool),
    }));
    const messages = PiMessageMapper.map(request.messages, this.model).map(
      (message) => ({
        role: message.role,
        content: message.content,
      }),
    );
    return Math.ceil(
      JSON.stringify({ systemPrompt, messages, tools }).length / 3,
    );
  }

  async generateText(systemPrompt: string, userText: string): Promise<string> {
    const response = await this.models.completeSimple(
      this.model,
      {
        systemPrompt,
        messages: [{ role: "user", content: userText, timestamp: Date.now() }],
      },
      { apiKey: this.config.apiKey, maxTokens: this.config.maxOutputTokens },
    );
    if (response.stopReason === "error" || response.stopReason === "aborted") {
      throw new Error(response.errorMessage ?? "Text generation failed");
    }
    return response.content
      .filter((content) => content.type === "text")
      .map((content) => content.text)
      .join("\n\n")
      .trim();
  }

  async generateSummary(
    messages: AiChatContextMessageDTO[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidateDTO> {
    const existingSummaryText = existingSummary
      ? JSON.stringify({
          userProfile: existingSummary.userProfile,
          durableFacts: existingSummary.durableFacts,
        })
      : "";
    const systemPrompt = PromptLoader.getSummarization(
      PromptLocale.PtBr,
      existingSummaryText,
    );
    const raw = await this.generateText(systemPrompt, JSON.stringify(messages));
    const jsonText = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "");
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch {
      throw new ValidationException(
        "The summarization response is not valid JSON",
      );
    }
    const candidate = summaryCandidateSchema.safeParse(parsedJson);
    if (!candidate.success) {
      throw new ValidationException(
        "The summarization response does not match the summary schema",
      );
    }
    return candidate.data;
  }

  private toJsonSchema(tool: AiToolDefinitionDTO): Record<string, unknown> {
    const { $schema, ...schema } = z.toJSONSchema(tool.inputSchema);
    return schema;
  }

  private getToolDefinitions(
    tools: AiToolDefinitionDTO[],
  ): AiToolDefinitionDTO[] {
    if (tools.some((tool) => tool.name === replyWithOptionsToolName)) {
      throw new ValidationException(
        `Tool name ${replyWithOptionsToolName} is reserved for assistant output`,
      );
    }
    return [...tools, replyWithOptionsTool];
  }

  private getProviderReasoningLevel(level: ReasoningEffortType): string {
    if (
      this.model.api === "openai-completions" &&
      this.model.compat &&
      "supportsReasoningEffort" in this.model.compat &&
      this.model.compat.supportsReasoningEffort === false
    ) {
      if (level === ReasoningEffort.Off) return ReasoningEffort.Off;
      return "enabled";
    }
    return this.model.thinkingLevelMap?.[level] ?? level;
  }

  private buildSystemPrompt(
    channelAddress: string,
    memory?: ConversationSummary,
  ): string {
    const systemPrompt = PromptLoader.getAiChatGateway(PromptLocale.PtBr, {
      channelAddress,
    });
    if (!memory) return systemPrompt;
    const memoryPrompt = PromptLoader.getConversationMemory(
      PromptLocale.PtBr,
      JSON.stringify({
        userProfile: memory.userProfile,
        durableFacts: memory.durableFacts,
      }),
    );
    return `${systemPrompt}\n\n${memoryPrompt}`;
  }
}
