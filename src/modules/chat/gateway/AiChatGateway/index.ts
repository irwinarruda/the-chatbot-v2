import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type {
  AiChatContextMessageDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiSummaryCandidateDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";

export type {
  AiChatContextMessageDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiSummaryCandidateDTO,
  AiToolDefinitionDTO,
  AssistantChannelContentDTO,
  TestAiScriptedResponseDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";

export interface AiChatGateway {
  getContextWindowTokens(): number;
  complete(request: AiCompletionRequestDTO): Promise<AiCompletionResponseDTO>;
  estimateInputTokens(request: AiInputEstimateRequestDTO): number;
  generateText(systemPrompt: string, userText: string): Promise<string>;
  generateSummary(
    messages: AiChatContextMessageDTO[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidateDTO>;
}
