import {
  getSupportedThinkingLevels,
  type Model,
  type MutableModels,
  type SimpleStreamOptions,
  Type,
} from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
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
  AiModelSelectionDTO,
  AiSummaryCandidateDTO,
  AiToolDefinitionDTO,
} from "~/modules/chat/gateway/AiChatGateway";
import { mapPiAssistantProgress } from "~/modules/chat/gateway/AiChatGateway/mapPiAssistantProgress";
import { mapPiAssistantResponse } from "~/modules/chat/gateway/AiChatGateway/mapPiAssistantResponse";
import { PiMessageMapper } from "~/modules/chat/gateway/AiChatGateway/PiMessageMapper";
import type { AiCredentialStore } from "~/modules/chat/gateway/AiCredentialStore";
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

export interface AiCredentialStoreFactory {
  create(idUser: string): AiCredentialStore;
}

export class PiAiChatGateway implements AiChatGateway {
  constructor(
    private config: AiConfig,
    private credentialStores?: AiCredentialStoreFactory,
  ) {
    this.getModel(this.getDefaultModel());
  }

  getDefaultModel(): AiModelSelectionDTO {
    return { provider: this.config.provider, model: this.config.model };
  }

  async getAvailableModels(idUser: string): Promise<AiModelSelectionDTO[]> {
    const credentials = this.credentialStores?.create(idUser);
    const models = this.createModels(credentials);
    const providerIds = new Set<string>([this.config.provider]);
    for (const credential of (await credentials?.list()) ?? []) {
      providerIds.add(credential.providerId);
    }
    const available: AiModelSelectionDTO[] = [];
    for (const providerId of providerIds) {
      for (const model of await models.getAvailable(providerId)) {
        available.push({ provider: model.provider, model: model.id });
      }
    }
    return available.sort((left, right) =>
      `${left.provider}/${left.model}`.localeCompare(
        `${right.provider}/${right.model}`,
      ),
    );
  }

  getContextWindowTokens(selection: AiModelSelectionDTO): number {
    return this.getModel(selection).contextWindow;
  }

  getMaxOutputTokens(selection: AiModelSelectionDTO): number {
    return this.getModel(selection).maxTokens;
  }

  getSupportedReasoningEfforts(
    selection: AiModelSelectionDTO,
  ): ReasoningEffortType[] {
    const model = this.getModel(selection);
    const levels = getSupportedThinkingLevels(model) as ReasoningEffortType[];
    const preferredLevels = new Map<string, ReasoningEffortType>();
    for (const level of levels) {
      const providerLevel = this.getProviderReasoningLevel(model, level);
      const preferred = preferredLevels.get(providerLevel);
      if (!preferred || providerLevel === level) {
        preferredLevels.set(providerLevel, level);
      }
    }
    return levels.filter(
      (level) =>
        preferredLevels.get(this.getProviderReasoningLevel(model, level)) ===
        level,
    );
  }

  async complete(
    request: AiCompletionRequestDTO,
    onProgress?: (progress: AiCompletionProgressDTO) => void,
  ): Promise<AiCompletionResponseDTO> {
    const models = this.createModels(
      this.credentialStores?.create(request.idUser),
    );
    const model = this.getModel(request.model, models);
    const systemPrompt = this.buildSystemPrompt(
      request.channelAddress,
      request.memory,
    );
    const options: SimpleStreamOptions = {};
    if (request.model.provider === "openai-codex") {
      options.transport = "sse";
    }
    if (request.reasoningEffort !== ReasoningEffort.Off) {
      options.reasoning = request.reasoningEffort;
    }
    const context = {
      systemPrompt,
      messages: PiMessageMapper.map(request.messages, model),
      tools: this.getToolDefinitions(request.tools).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: Type.Unsafe(this.toJsonSchema(tool)),
      })),
    };
    try {
      const stream = models.streamSimple(model, context, options);
      for await (const event of stream) {
        const progress = mapPiAssistantProgress(event);
        if (progress) onProgress?.(progress);
      }
      const response = await stream.result();
      if (
        response.stopReason === "error" ||
        response.stopReason === "aborted"
      ) {
        throw new Error(response.errorMessage ?? "Provider request failed");
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
    } catch {
      this.reportProviderFailure(request.model);
      throw this.providerFailure(request.model.provider);
    }
  }

  estimateInputTokens(request: AiInputEstimateRequestDTO): number {
    const model = this.getModel(request.model);
    const systemPrompt = this.buildSystemPrompt(
      request.channelAddress,
      request.memory,
    );
    const tools = this.getToolDefinitions(request.tools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.toJsonSchema(tool),
    }));
    const messages = PiMessageMapper.map(request.messages, model).map(
      (message) => ({
        role: message.role,
        content: message.content,
      }),
    );
    return Math.ceil(
      JSON.stringify({ systemPrompt, messages, tools }).length / 3,
    );
  }

  async generateText(
    idUser: string,
    selection: AiModelSelectionDTO,
    systemPrompt: string,
    userText: string,
  ): Promise<string> {
    const models = this.createModels(this.credentialStores?.create(idUser));
    const model = this.getModel(selection, models);
    try {
      const options: SimpleStreamOptions = {};
      if (selection.provider === "openai-codex") {
        options.transport = "sse";
      }
      const response = await models.completeSimple(
        model,
        {
          systemPrompt,
          messages: [
            { role: "user", content: userText, timestamp: Date.now() },
          ],
        },
        options,
      );
      if (
        response.stopReason === "error" ||
        response.stopReason === "aborted"
      ) {
        throw new Error(response.errorMessage ?? "Provider request failed");
      }
      return response.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("\n\n")
        .trim();
    } catch {
      this.reportProviderFailure(selection);
      throw this.providerFailure(selection.provider);
    }
  }

  async generateSummary(
    idUser: string,
    model: AiModelSelectionDTO,
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
    const raw = await this.generateText(
      idUser,
      model,
      systemPrompt,
      JSON.stringify(messages),
    );
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

  private getProviderReasoningLevel(
    model: Model<any>,
    level: ReasoningEffortType,
  ): string {
    if (
      model.api === "openai-completions" &&
      model.compat &&
      "supportsReasoningEffort" in model.compat &&
      model.compat.supportsReasoningEffort === false
    ) {
      if (level === ReasoningEffort.Off) return ReasoningEffort.Off;
      return "enabled";
    }
    return model.thinkingLevelMap?.[level] ?? level;
  }

  private createModels(credentials?: AiCredentialStore): MutableModels {
    return builtinModels({
      credentials,
      authContext: {
        env: async (name) => {
          if (name !== this.defaultProviderEnvironmentName()) return undefined;
          return this.config.apiKey;
        },
        fileExists: async () => false,
      },
    });
  }

  private getModel(
    selection: AiModelSelectionDTO,
    models: MutableModels = this.createModels(),
  ): Model<any> {
    const model = models.getModel(selection.provider, selection.model);
    if (!model) {
      throw new ValidationException(
        `Model ${selection.model} is not available for provider ${selection.provider}`,
      );
    }
    return model;
  }

  private defaultProviderEnvironmentName(): string | undefined {
    const names: Record<string, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      zai: "ZAI_API_KEY",
      "zai-coding-cn": "ZAI_CODING_CN_API_KEY",
    };
    return names[this.config.provider];
  }

  private providerFailure(provider: string): ValidationException {
    return new ValidationException(
      `The ${provider} provider could not complete the request`,
      "Check or reconnect this provider credential, then try again.",
    );
  }

  private reportProviderFailure(selection: AiModelSelectionDTO): void {
    console.error(
      `[AI provider failure] ${selection.provider}/${selection.model}: request_failed`,
    );
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
