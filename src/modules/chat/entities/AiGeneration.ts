import { v4 as uuidv4 } from "uuid";
import type { AiUsageDTO } from "~/modules/chat/entities/dtos/AiUsageDTO";
import {
  isReasoningEffort,
  type ReasoningEffort,
} from "~/modules/chat/entities/enums/ReasoningEffort";
import { ValidationException } from "~/shared/errors/DomainErrors";

export interface AiGenerationConfig {
  idChat: string;
  turnId: string;
  provider?: string;
  model?: string;
  api?: string;
  responseModel?: string;
  responseId?: string;
  reasoningEffort: ReasoningEffort;
  finishReason: string;
  usage?: AiUsageDTO;
  diagnostics?: unknown[];
}

export interface RestoredAiGenerationConfig extends AiGenerationConfig {
  id: string;
  sequence: number;
  createdAt: Date;
}

export class AiGeneration {
  id: string;
  idChat: string;
  turnId: string;
  sequence?: number;
  provider?: string;
  model?: string;
  api?: string;
  responseModel?: string;
  responseId?: string;
  reasoningEffort: ReasoningEffort;
  finishReason: string;
  usage?: AiUsageDTO;
  diagnostics?: unknown[];
  createdAt: Date;

  constructor(config: AiGenerationConfig) {
    this.id = uuidv4();
    this.idChat = config.idChat;
    this.turnId = config.turnId;
    this.sequence = undefined;
    this.provider = config.provider;
    this.model = config.model;
    this.api = config.api;
    this.responseModel = config.responseModel;
    this.responseId = config.responseId;
    this.reasoningEffort = config.reasoningEffort;
    this.finishReason = config.finishReason;
    this.usage = config.usage;
    this.diagnostics = config.diagnostics;
    this.createdAt = new Date();
    this.validate();
  }

  static restore(config: RestoredAiGenerationConfig): AiGeneration {
    const generation = new AiGeneration(config);
    generation.id = config.id;
    generation.sequence = config.sequence;
    generation.createdAt = config.createdAt;
    generation.validate();
    return generation;
  }

  private validate(): void {
    if (!this.id || !this.idChat || !this.turnId) {
      throw new ValidationException(
        "AI generations require an ID, chat ID, and turn ID",
      );
    }
    if (
      !Number.isSafeInteger(this.sequence ?? 1) ||
      (this.sequence ?? 1) <= 0
    ) {
      throw new ValidationException("AI generation sequence is invalid");
    }
    if (!isReasoningEffort(this.reasoningEffort)) {
      throw new ValidationException(
        "AI generation reasoning effort is invalid",
      );
    }
    if (!this.finishReason) {
      throw new ValidationException("AI generations require a finish reason");
    }
    if (Number.isNaN(this.createdAt.getTime())) {
      throw new ValidationException("AI generation timestamp is invalid");
    }
  }
}
