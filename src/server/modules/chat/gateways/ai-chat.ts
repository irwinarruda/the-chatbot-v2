import type {
  AiChatContextMessageDTO,
  AiCompletionProgressDTO,
  AiCompletionRequestDTO,
  AiCompletionResponseDTO,
  AiInputEstimateRequestDTO,
  AiModelSelectionDTO,
  AiSummaryCandidateDTO,
} from "~/domain/chat/ai-chat";
import type { ConversationSummary } from "~/domain/chat/conversation-summary";
import type { ReasoningEffort } from "~/domain/chat/reasoning-effort";

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
} from "~/domain/chat/ai-chat";

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
