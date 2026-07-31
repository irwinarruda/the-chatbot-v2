import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type {
  AiChatContextMessageDTO,
  AiCompletionProgressDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiSummaryCandidateDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";
import type { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import type { TextGenerationGateway } from "~/shared/gateway/TextGenerationGateway";

export type {
  AiChatContextMessageDTO,
  AiCompletionProgressDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiGenerationContextDTO,
  AiInputEstimateRequestDTO,
  AiSummaryCandidateDTO,
  AiToolDefinitionDTO,
  AssistantChannelContentDTO,
  AssistantGenerationContentDTO,
  TestAiScriptedResponseDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";

export interface AiChatGateway extends TextGenerationGateway {
  getContextWindowTokens(): number;
  getSupportedReasoningEfforts(): ReasoningEffort[];
  complete(
    request: AiCompletionRequestDTO,
    onProgress?: (progress: AiCompletionProgressDTO) => void,
  ): Promise<AiCompletionResponseDTO>;
  estimateInputTokens(request: AiInputEstimateRequestDTO): number;
  generateSummary(
    messages: AiChatContextMessageDTO[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidateDTO>;
}
