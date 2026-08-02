import type { z } from "zod";
import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type { AiUsageDTO } from "~/modules/chat/entities/dtos/AiUsageDTO";
import type { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import type { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import type { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import type {
  MessageContent,
  ToolCallContent,
} from "~/modules/chat/entities/Message";

export interface AiToolDefinitionDTO {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

export interface AiModelSelectionDTO {
  provider: string;
  model: string;
}

export interface AiModelConfigurationDTO {
  currentModel: AiModelSelectionDTO;
  availableModels: AiModelSelectionDTO[];
  supportedReasoningEfforts: ReasoningEffort[];
}

export interface AiChatContextMessageDTO {
  role: MessageRole;
  content: MessageContent;
  timestamp: number;
  generation?: AiGenerationContextDTO;
}

export interface AiGenerationContextDTO {
  id: string;
  provider?: string;
  model?: string;
  api?: string;
  responseModel?: string;
  responseId?: string;
  finishReason: string;
  usage?: AiUsageDTO;
  diagnostics?: unknown[];
  timestamp: number;
}

export interface AiCompletionRequestDTO {
  idUser: string;
  model: AiModelSelectionDTO;
  channelAddress: string;
  messages: AiChatContextMessageDTO[];
  tools: AiToolDefinitionDTO[];
  reasoningEffort: ReasoningEffort;
  memory?: ConversationSummary;
}

export type AssistantChannelContentDTO = Extract<
  MessageContent,
  | { type: typeof MessageContentType.Text }
  | { type: typeof MessageContentType.Button }
>;

export type AssistantGenerationContentDTO = Extract<
  MessageContent,
  | { type: typeof MessageContentType.Text }
  | { type: typeof MessageContentType.Button }
  | { type: typeof MessageContentType.Reasoning }
  | { type: typeof MessageContentType.ToolCall }
>;

export interface AiCompletionResponseDTO {
  provider: string;
  model: string;
  api: string;
  responseModel?: string;
  responseId?: string;
  items: AssistantGenerationContentDTO[];
  finishReason: string;
  usage: AiUsageDTO;
  diagnostics?: unknown[];
}

export type AiCompletionProgressDTO =
  | {
      type: "reasoningDelta";
      contentIndex: number;
      delta: string;
    }
  | {
      type: "toolCall";
      contentIndex: number;
      call: ToolCallContent;
    };

export interface AiInputEstimateRequestDTO {
  idUser: string;
  model: AiModelSelectionDTO;
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
  items?: AssistantGenerationContentDTO[];
  finishReason: string;
}
