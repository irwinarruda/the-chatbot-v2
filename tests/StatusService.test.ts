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
  });
});
