import type {
  AiAgentRequest,
  AiAgentResponse,
  AiChatContextMessage,
  AiInputEstimateRequest,
  AiSummaryCandidate,
  AssistantChannelContent,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import type { ConversationSummary } from "~/shared/entities/ConversationSummary";
import { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import { MessageRole } from "~/shared/entities/enums/MessageRole";
import type { ToolCallContent } from "~/shared/entities/Message";

export interface TestAiScriptedResponse {
  content?: AssistantChannelContent;
  toolCalls: ToolCallContent[];
  finishReason: string;
}

export class TestAiChatGateway implements IAiChatGateway {
  lastChannelAddress?: string;
  lastRequest?: AiAgentRequest;
  requests: AiAgentRequest[] = [];
  scriptedResponses: TestAiScriptedResponse[] = [];
  scriptedTexts: string[] = [];
  summaryError?: Error;
  summaryCalls = 0;
  contextWindowTokens = 1_000_000;

  getContextWindowTokens(): number {
    return this.contextWindowTokens;
  }

  async runAgent(request: AiAgentRequest): Promise<AiAgentResponse> {
    this.lastChannelAddress = request.channelAddress;
    this.lastRequest = request;
    const messages = [...request.messages];
    let toolRounds = 0;
    for (;;) {
      const roundRequest = { ...request, messages: [...messages] };
      this.requests.push(roundRequest);
      const scripted = this.scriptedResponses.shift();
      if (!scripted) {
        const lastUserMessage = [...messages]
          .reverse()
          .find((message) => message.role === MessageRole.User);
        return {
          content: {
            type: MessageContentType.Text,
            text: `Response to: ${this.messageText(lastUserMessage).trim()}`,
          },
          finishReason: "stop",
          toolRounds,
        };
      }
      if (scripted.toolCalls.length === 0) {
        return {
          content: scripted.content,
          finishReason: scripted.finishReason,
          toolRounds,
        };
      }
      toolRounds += 1;
      await request.onToolCalls(scripted.toolCalls, scripted.content);
      if (scripted.content) {
        messages.push({
          role: MessageRole.Assistant,
          content: scripted.content,
        });
      }
      for (const call of scripted.toolCalls) {
        messages.push({ role: MessageRole.Assistant, content: call });
      }
      for (const call of scripted.toolCalls) {
        const result = await request.executeTool(call);
        messages.push({ role: MessageRole.Tool, content: result });
      }
      if (toolRounds >= request.maxToolRounds) {
        return {
          finishReason: scripted.finishReason,
          toolRounds,
        };
      }
    }
  }

  estimateInputTokens(request: AiInputEstimateRequest): number {
    return Math.ceil(JSON.stringify(request).length / 3);
  }

  async generateText(
    _systemPrompt: string,
    _userText: string,
  ): Promise<string> {
    return this.scriptedTexts.shift() ?? "";
  }

  async generateSummary(
    messages: AiChatContextMessage[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidate> {
    this.summaryCalls += 1;
    if (this.summaryError) throw this.summaryError;
    return {
      userProfile: [
        ...(existingSummary?.userProfile ?? []),
        `Summary of ${messages.length} messages`,
      ],
      durableFacts: existingSummary?.durableFacts ?? [],
    };
  }

  private messageText(message?: AiChatContextMessage): string {
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
}
