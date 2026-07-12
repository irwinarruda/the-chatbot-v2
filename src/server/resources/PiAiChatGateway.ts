import { Agent, type AgentTool } from "@earendil-works/pi-agent-core";
import {
  type AssistantMessage,
  createModels,
  type Model,
  type MutableModels,
  type TSchema,
  Type,
} from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { zaiProvider } from "@earendil-works/pi-ai/providers/zai";
import { z } from "zod";
import type { AiConfig } from "~/infra/config";
import { ValidationException } from "~/infra/exceptions";
import type {
  AiAgentRequest,
  AiAgentResponse,
  AiChatContextMessage,
  AiInputEstimateRequest,
  AiSummaryCandidate,
  AiToolDefinition,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import { AssistantTextParser } from "~/server/utils/AssistantTextParser";
import { PiMessageMapper } from "~/server/utils/PiMessageMapper";
import { PromptLoader, PromptLocale } from "~/server/utils/PromptLoader";
import type { ConversationSummary } from "~/shared/entities/ConversationSummary";
import { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import { ToolResultStatus } from "~/shared/entities/enums/ToolResultStatus";
import type {
  ToolCallContent,
  ToolResultOutcome,
} from "~/shared/entities/Message";

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

  async runAgent(request: AiAgentRequest): Promise<AiAgentResponse> {
    const systemPrompt = this.buildSystemPrompt(
      request.channelAddress,
      request.memory,
    );
    let toolRounds = 0;
    let roundLimitReached = false;
    let lastAssistant: AssistantMessage | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    const toolCalls = new Map<string, ToolCallContent>();
    const tools = request.tools.map((definition) =>
      this.toAgentTool(definition, request, () => toolRounds),
    );
    let agent: Agent;
    agent = new Agent({
      initialState: {
        systemPrompt,
        model: this.model,
        tools,
        messages: PiMessageMapper.map(request.messages, this.model),
      },
      streamFn: (model, context, options) =>
        this.models.streamSimple(model, context, options),
      getApiKey: () => this.config.apiKey,
      toolExecution: "sequential",
      prepareNextTurnWithContext: ({ message }) => {
        if (
          message.role === "assistant" &&
          message.content.some((content) => content.type === "toolCall") &&
          toolRounds >= request.maxToolRounds
        ) {
          roundLimitReached = true;
          agent.abort();
        }
        return undefined;
      },
      afterToolCall: async ({ result }) => {
        const outcome = result.details as ToolResultOutcome;
        return {
          isError: outcome.status !== ToolResultStatus.Succeeded,
        };
      },
    });
    const unsubscribe = agent.subscribe(async (event) => {
      if (event.type === "tool_execution_end" && event.isError) {
        const call = toolCalls.get(event.toolCallId);
        if (call) await request.executeTool(call);
        return;
      }
      if (event.type !== "message_end" || event.message.role !== "assistant") {
        return;
      }
      const message = event.message;
      if (roundLimitReached && message.stopReason === "aborted") return;
      lastAssistant = message;
      inputTokens += message.usage.input;
      outputTokens += message.usage.output;
      const calls = message.content
        .filter((content) => content.type === "toolCall")
        .map<ToolCallContent>((call) => ({
          type: MessageContentType.ToolCall,
          callId: call.id,
          name: call.name,
          arguments: call.arguments,
        }));
      if (calls.length === 0) return;
      for (const call of calls) toolCalls.set(call.callId, call);
      toolRounds += 1;
      const text = message.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("\n\n")
        .trim();
      await request.onToolCalls(
        calls,
        text ? AssistantTextParser.parse(text) : undefined,
      );
    });
    try {
      await agent.continue();
      if (!lastAssistant) {
        throw new Error(
          agent.state.errorMessage ?? "The AI returned no response",
        );
      }
      if (
        !roundLimitReached &&
        (lastAssistant.stopReason === "error" ||
          lastAssistant.stopReason === "aborted")
      ) {
        throw new Error(
          lastAssistant.errorMessage ??
            "The AI response could not be completed",
        );
      }
      const hasToolCalls = lastAssistant.content.some(
        (content) => content.type === "toolCall",
      );
      const text = lastAssistant.content
        .filter((content) => content.type === "text")
        .map((content) => content.text)
        .join("\n\n")
        .trim();
      return {
        content:
          !hasToolCalls && text ? AssistantTextParser.parse(text) : undefined,
        finishReason: lastAssistant.stopReason,
        usage: { inputTokens, outputTokens },
        toolRounds,
      };
    } finally {
      unsubscribe();
      agent.abort();
      agent.reset();
    }
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

  private toAgentTool(
    definition: AiToolDefinition,
    request: AiAgentRequest,
    getToolRounds: () => number,
  ): AgentTool<TSchema, ToolResultOutcome> {
    return {
      name: definition.name,
      label: definition.name,
      description: definition.description,
      parameters: Type.Unsafe(this.toJsonSchema(definition)),
      executionMode: "sequential",
      execute: async (toolCallId, params) => {
        const result = await request.executeTool({
          type: MessageContentType.ToolCall,
          callId: toolCallId,
          name: definition.name,
          arguments: params,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result.outcome) }],
          details: result.outcome,
          terminate: getToolRounds() >= request.maxToolRounds,
        };
      },
    };
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
