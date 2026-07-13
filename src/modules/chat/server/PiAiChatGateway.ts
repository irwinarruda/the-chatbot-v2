import {
  createModels,
  type Model,
  type MutableModels,
  Type,
} from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { zaiProvider } from "@earendil-works/pi-ai/providers/zai";
import { z } from "zod";
import type {
  AiChatContextMessage,
  AiCompletionRequest,
  AiCompletionResponse,
  AiInputEstimateRequest,
  AiSummaryCandidate,
  AiToolDefinition,
  IAiChatGateway,
} from "~/modules/chat/application/ports/IAiChatGateway";
import type { ConversationSummary } from "~/modules/chat/domain/ConversationSummary";
import { MessageContentType } from "~/modules/chat/domain/enums/MessageContentType";
import { AssistantTextParser } from "~/modules/chat/server/AssistantTextParser";
import { PiMessageMapper } from "~/modules/chat/server/PiMessageMapper";
import { PromptLoader, PromptLocale } from "~/modules/chat/server/PromptLoader";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { AiConfig } from "~/shared/server/Config";

const summaryCandidateSchema = z.object({
  userProfile: z.array(z.string()),
  durableFacts: z.array(z.string()),
});

export class PiAiChatGateway implements IAiChatGateway {
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

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const systemPrompt = this.buildSystemPrompt(
      request.channelAddress,
      request.memory,
    );
    const response = await this.models.completeSimple(
      this.model,
      {
        systemPrompt,
        messages: PiMessageMapper.map(request.messages, this.model),
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: Type.Unsafe(this.toJsonSchema(tool)),
        })),
      },
      { apiKey: this.config.apiKey, maxTokens: this.config.maxOutputTokens },
    );
    if (response.stopReason === "error" || response.stopReason === "aborted") {
      throw new Error(response.errorMessage ?? "The AI returned no response");
    }
    const text = response.content
      .filter((content) => content.type === "text")
      .map((content) => content.text)
      .join("\n\n")
      .trim();
    return {
      content: text ? AssistantTextParser.parse(text) : undefined,
      toolCalls: response.content
        .filter((content) => content.type === "toolCall")
        .map((call) => ({
          type: MessageContentType.ToolCall,
          callId: call.id,
          name: call.name,
          arguments: call.arguments,
        })),
      finishReason: response.stopReason,
      usage: {
        inputTokens: response.usage.input,
        outputTokens: response.usage.output,
      },
    };
  }

  estimateInputTokens(request: AiInputEstimateRequest): number {
    const systemPrompt = this.buildSystemPrompt(
      request.channelAddress,
      request.memory,
    );
    const tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: this.toJsonSchema(tool),
    }));
    return Math.ceil(
      JSON.stringify({ systemPrompt, messages: request.messages, tools })
        .length / 3,
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
    messages: AiChatContextMessage[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidate> {
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

  private toJsonSchema(tool: AiToolDefinition): Record<string, unknown> {
    const { $schema, ...schema } = z.toJSONSchema(tool.inputSchema);
    return schema;
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
