import { UnauthorizedException } from "~/infra/exceptions";
import { orquestrator } from "./orquestrator";

describe("MigrationService", () => {
  test("testMigration", async () => {
    await orquestrator.wipeDatabase();
    const migrationCount = 11;
    let migrations =
      await orquestrator.migrationService.listPendingMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.length).toBe(migrationCount);
    await orquestrator.migrationService.runPendingMigrations(
      orquestrator.authConfig.hashPassword,
    );
    migrations = await orquestrator.migrationService.listPendingMigrations();
    expect(migrations.length).toBe(0);
    await orquestrator.migrationService.resetMigrations(
      orquestrator.authConfig.hashPassword,
    );
    migrations = await orquestrator.migrationService.listPendingMigrations();
    expect(migrations.length).toBe(migrationCount);
  });

  test("testMigrationAuth", async () => {
    await orquestrator.wipeDatabase();
    await expect(
      orquestrator.migrationService.runPendingMigrations("WrongPassword"),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      orquestrator.migrationService.resetMigrations("WrongPassword"),
    ).rejects.toThrow(UnauthorizedException);
  });
});
