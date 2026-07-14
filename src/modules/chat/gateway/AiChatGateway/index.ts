import type { z } from "zod";
import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import type { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import type {
  MessageContent,
  ToolCallContent,
} from "~/modules/chat/entities/Message";

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export interface AiChatContextMessage {
  role: MessageRole;
  content: MessageContent;
}

export interface AiCompletionRequest {
  channelAddress: string;
  messages: AiChatContextMessage[];
  tools: AiToolDefinition[];
  memory?: ConversationSummary;
}

export type AssistantChannelContent = Extract<
  MessageContent,
  | { type: typeof MessageContentType.Text }
  | { type: typeof MessageContentType.Button }
>;

export interface AiCompletionResponse {
  content?: AssistantChannelContent;
  toolCalls: ToolCallContent[];
  finishReason: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AiInputEstimateRequest {
  channelAddress: string;
  messages: AiChatContextMessage[];
  tools: AiToolDefinition[];
  memory?: ConversationSummary;
}

export interface AiSummaryCandidate {
  userProfile: string[];
  durableFacts: string[];
}

export interface AiChatGateway {
  getContextWindowTokens(): number;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
  estimateInputTokens(request: AiInputEstimateRequest): number;
  generateText(systemPrompt: string, userText: string): Promise<string>;
  generateSummary(
    messages: AiChatContextMessage[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidate>;
}
