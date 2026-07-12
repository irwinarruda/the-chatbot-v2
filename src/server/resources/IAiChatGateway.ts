import type { z } from "zod";
import type { ConversationSummary } from "~/shared/entities/ConversationSummary";
import type { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import type { MessageRole } from "~/shared/entities/enums/MessageRole";
import type {
  MessageContent,
  ToolCallContent,
  ToolResultContent,
} from "~/shared/entities/Message";

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export interface AiChatContextMessage {
  role: MessageRole;
  content: MessageContent;
}

export interface AiAgentRequest {
  channelAddress: string;
  messages: AiChatContextMessage[];
  tools: AiToolDefinition[];
  memory?: ConversationSummary;
  maxToolRounds: number;
  onToolCalls(
    calls: ToolCallContent[],
    content?: AssistantChannelContent,
  ): Promise<void>;
  executeTool(call: ToolCallContent): Promise<ToolResultContent>;
}

export type AssistantChannelContent = Extract<
  MessageContent,
  | { type: typeof MessageContentType.Text }
  | { type: typeof MessageContentType.Button }
>;

export interface AiAgentResponse {
  content?: AssistantChannelContent;
  finishReason: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  toolRounds: number;
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

export interface IAiChatGateway {
  getContextWindowTokens(): number;
  runAgent(request: AiAgentRequest): Promise<AiAgentResponse>;
  estimateInputTokens(request: AiInputEstimateRequest): number;
  generateText(systemPrompt: string, userText: string): Promise<string>;
  generateSummary(
    messages: AiChatContextMessage[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidate>;
}
