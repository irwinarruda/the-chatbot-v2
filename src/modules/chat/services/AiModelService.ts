import type postgres from "postgres";
import type { AiModelSelectionDTO } from "~/modules/chat/entities/dtos/AiChatGatewayDTO";
import type { AiChatGateway } from "~/modules/chat/gateway/AiChatGateway";
import type { AiModelPreferenceService } from "~/modules/chat/services/AiModelPreferenceService";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { TextGenerationGateway } from "~/shared/gateway/TextGenerationGateway";

export class AiModelService implements TextGenerationGateway {
  constructor(
    private preferences: AiModelPreferenceService,
    private gateway: AiChatGateway,
  ) {}

  async getForUser(idUser: string): Promise<AiModelSelectionDTO> {
    const preference = await this.preferences.getForUser(idUser);
    const defaultModel = this.gateway.getDefaultModel();
    if (!preference) return defaultModel;
    const preferredModel = {
      provider: preference.providerId,
      model: preference.modelId,
    };
    const availableModels = await this.getAvailableForUser(idUser);
    const availablePreference = availableModels.find((candidate) =>
      this.isSameModel(candidate, preferredModel),
    );
    if (availablePreference) return availablePreference;
    const availableDefault = availableModels.find((candidate) =>
      this.isSameModel(candidate, defaultModel),
    );
    if (availableDefault) return availableDefault;
    const firstAvailable = availableModels[0];
    if (firstAvailable) return firstAvailable;
    return defaultModel;
  }

  getAvailableForUser(idUser: string): Promise<AiModelSelectionDTO[]> {
    return this.gateway.getAvailableModels(idUser);
  }

  async isAvailableForUser(
    idUser: string,
    selection: AiModelSelectionDTO,
  ): Promise<boolean> {
    const available = await this.getAvailableForUser(idUser);
    return available.some((candidate) =>
      this.isSameModel(candidate, selection),
    );
  }

  async saveForUser(
    idUser: string,
    selection: AiModelSelectionDTO,
    sql?: postgres.Sql,
  ): Promise<void> {
    if (!(await this.isAvailableForUser(idUser, selection))) {
      throw new ValidationException(
        `Model ${selection.provider}/${selection.model} is not configured`,
      );
    }
    await this.preferences.save(
      {
        idUser,
        providerId: selection.provider,
        modelId: selection.model,
      },
      sql,
    );
  }

  async generateText(
    idUser: string,
    systemPrompt: string,
    userText: string,
  ): Promise<string> {
    const model = await this.getForUser(idUser);
    return this.gateway.generateText(idUser, model, systemPrompt, userText);
  }

  private isSameModel(
    left: AiModelSelectionDTO,
    right: AiModelSelectionDTO,
  ): boolean {
    return left.provider === right.provider && left.model === right.model;
  }
}
