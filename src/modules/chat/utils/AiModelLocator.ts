import type { AiModelSelectionDTO } from "~/modules/chat/entities/dtos/AiChatGatewayDTO";

export function toAiModelLocator(model: AiModelSelectionDTO): string {
  return `${model.provider}/${model.model}`;
}
