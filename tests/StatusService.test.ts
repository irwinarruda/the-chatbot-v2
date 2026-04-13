import { StatusService } from "~/server/services/StatusService";
import { orquestrator } from "./orquestrator";

describe("StatusService", () => {
  test("getStatus should work", async () => {
    const dto = await orquestrator.statusService.getStatus();
    expect(dto).not.toBeNull();
    const date = new Date().toISOString().slice(0, 10);
    expect(dto.updatedAt.toISOString().slice(0, 10)).toBe(date);
    expect(dto.database.serverVersion).toContain(
      orquestrator.databaseConfig.serverVersion,
    );
    expect(dto.database.maxConnections).toBeGreaterThan(0);
    expect(dto.database.openConnections).toBeGreaterThanOrEqual(1);
    expect(dto.ai.modelName).toBe(orquestrator.aiConfig.model);
  });

  test("getStatus falls back to defaults when database metadata is missing", async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = new StatusService(
      { sql } as unknown as typeof orquestrator.database,
      orquestrator.databaseConfig,
      orquestrator.aiConfig,
    );

    const dto = await service.getStatus();

    expect(dto.database.serverVersion).toBe("unknown");
    expect(dto.database.maxConnections).toBe(0);
    expect(dto.database.openConnections).toBe(0);
    expect(dto.ai.modelName).toBe(orquestrator.aiConfig.model);
  });
});
