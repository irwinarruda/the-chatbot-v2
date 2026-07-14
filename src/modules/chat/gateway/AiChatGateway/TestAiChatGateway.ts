import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import type { ToolCallContent } from "~/modules/chat/entities/Message";
import type {
  AiChatContextMessage,
  AiChatGateway,
  AiCompletionRequest,
  AiCompletionResponse,
  AiInputEstimateRequest,
  AiSummaryCandidate,
  AssistantChannelContent,
} from "~/modules/chat/gateway/AiChatGateway";

export interface TestAiScriptedResponse {
  content?: AssistantChannelContent;
  toolCalls: ToolCallContent[];
  finishReason: string;
}

export class TestAiChatGateway implements AiChatGateway {
  lastChannelAddress?: string;
  lastRequest?: AiCompletionRequest;
  requests: AiCompletionRequest[] = [];
  scriptedResponses: TestAiScriptedResponse[] = [];
  scriptedTexts: string[] = [];
  summaryError?: Error;
  summaryCalls = 0;
  contextWindowTokens = 1_000_000;

  getContextWindowTokens(): number {
    return this.contextWindowTokens;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    this.lastChannelAddress = request.channelAddress;
    this.lastRequest = request;
    this.requests.push(request);
    const scripted = this.scriptedResponses.shift();
    if (scripted) {
      return {
        content: scripted.content,
        toolCalls: scripted.toolCalls,
        finishReason: scripted.finishReason,
      };
    }
    const lastUserMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === MessageRole.User);
    return {
      content: {
        type: MessageContentType.Text,
        text: `Response to: ${this.messageText(lastUserMessage).trim()}`,
      },
      toolCalls: [],
      finishReason: "stop",
    };
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
