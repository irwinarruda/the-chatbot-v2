import type { ConversationSummary } from "~/modules/chat/entities/ConversationSummary";
import type {
  AiChatContextMessageDTO,
  AiCompletionProgressDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiModelSelectionDTO,
  AiSummaryCandidateDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";
import type { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";

export type {
  AiChatContextMessageDTO,
  AiCompletionProgressDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiGenerationContextDTO,
  AiInputEstimateRequestDTO,
  AiModelConfigurationDTO,
  AiModelSelectionDTO,
  AiSummaryCandidateDTO,
  AiToolDefinitionDTO,
  AssistantChannelContentDTO,
  AssistantGenerationContentDTO,
  TestAiScriptedResponseDTO,
} from "~/modules/chat/entities/dtos/AiChatGatewayDTO";

export interface AiChatGateway {
  getDefaultModel(): AiModelSelectionDTO;
  getAvailableModels(idUser: string): Promise<AiModelSelectionDTO[]>;
  getContextWindowTokens(model: AiModelSelectionDTO): number;
  getMaxOutputTokens(model: AiModelSelectionDTO): number;
  getSupportedReasoningEfforts(model: AiModelSelectionDTO): ReasoningEffort[];
  complete(
    request: AiCompletionRequestDTO,
    onProgress?: (progress: AiCompletionProgressDTO) => void,
  ): Promise<AiCompletionResponseDTO>;
  estimateInputTokens(request: AiInputEstimateRequestDTO): number;
  generateText(
    idUser: string,
    model: AiModelSelectionDTO,
    systemPrompt: string,
    userText: string,
  ): Promise<string>;
  generateSummary(
    idUser: string,
    model: AiModelSelectionDTO,
    messages: AiChatContextMessageDTO[],
    existingSummary?: ConversationSummary,
  ): Promise<AiSummaryCandidateDTO>;
}
