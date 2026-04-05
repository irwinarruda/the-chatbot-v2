import { UnauthorizedException } from "~/infra/exceptions";
import { orquestrator } from "./orquestrator";

describe("MigrationService", () => {
  const migrationService = () => orquestrator.migrationService;

  test("testMigration", async () => {
    await orquestrator.wipeDatabase();
    const migrationCount = 10;
    let migrations = await migrationService().listPendingMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.length).toBe(migrationCount);
    await migrationService().runPendingMigrations(
      orquestrator.authConfig.hashPassword,
    );
    migrations = await migrationService().listPendingMigrations();
    expect(migrations.length).toBe(0);
    await migrationService().resetMigrations(
      orquestrator.authConfig.hashPassword,
    );
    migrations = await migrationService().listPendingMigrations();
    expect(migrations.length).toBe(migrationCount);
  });

  test("testMigrationAuth", async () => {
    await orquestrator.wipeDatabase();
    await expect(
      migrationService().runPendingMigrations("WrongPassword"),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      migrationService().resetMigrations("WrongPassword"),
    ).rejects.toThrow(UnauthorizedException);
  });
});
