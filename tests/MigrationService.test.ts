import { runner } from "node-pg-migrate";
import { Paths } from "~/infra/paths";
import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";
import { orquestrator } from "./orquestrator";

const noop = () => {};
const noopLogger = { debug: noop, info: noop, warn: noop, error: noop };

describe("MigrationService", () => {
  test("testMigration", async () => {
    await orquestrator.wipeDatabase();
    const migrationCount = 23;
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

  test("credential reset preserves the existing user", async () => {
    await orquestrator.clearDatabase();
    await runner({
      databaseUrl: orquestrator.databaseConfig.connectionString,
      dir: Paths.migrationsDir(),
      direction: "down",
      migrationsTable: "pgmigrations",
      count: 4,
      noLock: true,
      logger: noopLogger,
    });
    const userId = crypto.randomUUID();
    await orquestrator.database.sql`
      INSERT INTO users (id, name, phone_number)
      VALUES (${userId}, ${"Existing User"}, ${"5511984444444"})
    `;
    await orquestrator.database.sql`
      INSERT INTO google_credentials (
        id_user,
        access_token,
        refresh_token
      )
      VALUES (
        ${userId},
        ${"legacy-access-token"},
        ${"legacy-refresh-token"}
      )
    `;

    await orquestrator.migrationService.runPendingMigrations(
      orquestrator.authConfig.hashPassword,
    );

    const users = await orquestrator.database
      .sql`SELECT id FROM users WHERE id = ${userId}`;
    const credentials = await orquestrator.database
      .sql`SELECT id FROM google_credentials`;
    const tokenColumns = await orquestrator.database.sql<
      { column_name: string }[]
    >`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'google_credentials'
        AND column_name IN (
          'access_token',
          'refresh_token',
          'token_envelope'
        )
      ORDER BY column_name
    `;
    expect(users).toHaveLength(1);
    expect(credentials).toHaveLength(0);
    expect(tokenColumns).toEqual([{ column_name: "token_envelope" }]);
  });
});
