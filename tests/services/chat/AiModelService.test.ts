import { TestAiChatGateway } from "~/modules/chat/gateway/AiChatGateway/TestAiChatGateway";
import { AiModelPreferenceService } from "~/modules/chat/services/AiModelPreferenceService";
import { AiModelService } from "~/modules/chat/services/AiModelService";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

describe("AiModelService", () => {
  test("keeps a persisted model while it remains available", async () => {
    const { gateway, preferences, service } = createService();
    gateway.availableModels = [
      gateway.getDefaultModel(),
      { provider: "openai-codex", model: "gpt-5.6-luna" },
    ];
    vi.spyOn(preferences, "getForUser").mockResolvedValue({
      idUser: "3c6fab2a-fb83-4451-bfdd-3efa8144f7e4",
      providerId: "openai-codex",
      modelId: "gpt-5.6-luna",
    });

    await expect(
      service.getForUser("3c6fab2a-fb83-4451-bfdd-3efa8144f7e4"),
    ).resolves.toEqual({
      provider: "openai-codex",
      model: "gpt-5.6-luna",
    });
  });

  test("falls back to the configured default when a preference becomes unavailable", async () => {
    const { gateway, preferences, service } = createService();
    gateway.availableModels = [gateway.getDefaultModel()];
    vi.spyOn(preferences, "getForUser").mockResolvedValue({
      idUser: "3c6fab2a-fb83-4451-bfdd-3efa8144f7e4",
      providerId: "removed-provider",
      modelId: "removed-model",
    });

    await expect(
      service.getForUser("3c6fab2a-fb83-4451-bfdd-3efa8144f7e4"),
    ).resolves.toEqual(gateway.getDefaultModel());
  });

  test("uses another available model when the preference and default are unavailable", async () => {
    const { gateway, preferences, service } = createService();
    gateway.availableModels = [
      { provider: "openai-codex", model: "gpt-5.6-luna" },
    ];
    vi.spyOn(preferences, "getForUser").mockResolvedValue({
      idUser: "3c6fab2a-fb83-4451-bfdd-3efa8144f7e4",
      providerId: "removed-provider",
      modelId: "removed-model",
    });

    await expect(
      service.getForUser("3c6fab2a-fb83-4451-bfdd-3efa8144f7e4"),
    ).resolves.toEqual({
      provider: "openai-codex",
      model: "gpt-5.6-luna",
    });
  });
});

function createService() {
  const preferences = new AiModelPreferenceService({} as DatabaseGateway);
  const gateway = new TestAiChatGateway();
  return {
    gateway,
    preferences,
    service: new AiModelService(preferences, gateway),
  };
}
