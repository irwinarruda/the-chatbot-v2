import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";
import { orquestrator } from "./orquestrator";

describe("MigrationService", () => {
  test("testMigration", async () => {
    await orquestrator.wipeDatabase();
    const migrationCount = 17;
    let migrations =
      await orquestrator.migrationService.listPendingMigrations();
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.length).toBe(migrationCount);
    await orquestrator.migrationService.runPendingMigrations(
      orquestrator.authConfig.hashPassword,
    );
    migrations = await orquestrator.migrationService.listPendingMigrations();
    expect(migrations.length).toBe(0);
    const legacyMessageColumns = await orquestrator.database.sql<
      { column_name: string }[]
    >`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name IN (
        'type',
        'user_type',
        'text',
        'button_reply',
        'button_reply_options',
        'media_id',
        'media_url',
        'mime_type',
        'transcript'
      )
    `;
    expect(legacyMessageColumns).toHaveLength(0);
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
