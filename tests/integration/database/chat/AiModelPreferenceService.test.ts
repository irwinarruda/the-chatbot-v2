import { AiModelPreferenceService } from "~/modules/chat/services/AiModelPreferenceService";
import { orquestrator } from "~/tests/orquestrator";

describe("AiModelPreferenceService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("creates, replaces, and clears a user's model preference", async () => {
    const user = await orquestrator.createUser();
    const service = new AiModelPreferenceService(orquestrator.database);

    expect(await service.getForUser(user.id)).toBeUndefined();
    await service.save({
      idUser: user.id,
      providerId: "zai",
      modelId: "glm-4.7",
    });
    expect(await service.getForUser(user.id)).toEqual({
      idUser: user.id,
      providerId: "zai",
      modelId: "glm-4.7",
    });

    await service.save({
      idUser: user.id,
      providerId: "openai-codex",
      modelId: "gpt-5.3-codex",
    });
    expect(await service.getForUser(user.id)).toEqual({
      idUser: user.id,
      providerId: "openai-codex",
      modelId: "gpt-5.3-codex",
    });

    await service.clearForUser(user.id);
    expect(await service.getForUser(user.id)).toBeUndefined();
  });

  test("scopes preferences by user and deletes them with the user", async () => {
    const firstUser = await orquestrator.createUser();
    const secondUser = await orquestrator.createUser();
    const service = new AiModelPreferenceService(orquestrator.database);
    await service.save({
      idUser: firstUser.id,
      providerId: "zai",
      modelId: "glm-4.7",
    });
    await service.save({
      idUser: secondUser.id,
      providerId: "openai-codex",
      modelId: "gpt-5.3-codex",
    });

    await orquestrator.database
      .sql`DELETE FROM users WHERE id = ${firstUser.id}`;

    expect(await service.getForUser(firstUser.id)).toBeUndefined();
    expect(await service.getForUser(secondUser.id)).toEqual({
      idUser: secondUser.id,
      providerId: "openai-codex",
      modelId: "gpt-5.3-codex",
    });
  });
});
