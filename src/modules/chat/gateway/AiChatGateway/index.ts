import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type {
  AiChatContextMessageDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiSummaryCandidateDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";
import type { TextGenerationGateway } from "~/shared/gateway/TextGenerationGateway";

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

export interface AiChatGateway extends TextGenerationGateway {
  getContextWindowTokens(): number;
  complete(request: AiCompletionRequestDTO): Promise<AiCompletionResponseDTO>;
  estimateInputTokens(request: AiInputEstimateRequestDTO): number;
  generateSummary(
    messages: AiChatContextMessageDTO[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidateDTO>;
}
