import type { z } from "zod";
import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import type { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import type {
  MessageContent,
  ToolCallContent,
} from "~/modules/chat/entities/Message";

export interface AiToolDefinitionDTO {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export interface AiChatContextMessageDTO {
  role: MessageRole;
  content: MessageContent;
}

export interface AiCompletionRequestDTO {
  channelAddress: string;
  messages: AiChatContextMessageDTO[];
  tools: AiToolDefinitionDTO[];
  memory?: ConversationSummary;
}

export type AssistantChannelContentDTO = Extract<
  MessageContent,
  | { type: typeof MessageContentType.Text }
  | { type: typeof MessageContentType.Button }
>;

export interface AiCompletionResponseDTO {
  content?: AssistantChannelContentDTO;
  toolCalls: ToolCallContent[];
  finishReason: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AiInputEstimateRequestDTO {
  channelAddress: string;
  messages: AiChatContextMessageDTO[];
  tools: AiToolDefinitionDTO[];
  memory?: ConversationSummary;
}

export interface AiSummaryCandidateDTO {
  userProfile: string[];
  durableFacts: string[];
}

export interface TestAiScriptedResponseDTO {
  content?: AssistantChannelContentDTO;
  toolCalls: ToolCallContent[];
  finishReason: string;
}
