import { runner } from "node-pg-migrate";
import { Paths } from "~/infra/paths";
import { UnauthorizedException } from "~/shared/errors/ApplicationErrors";
import { orquestrator } from "./orquestrator";

const noop = () => {};
const noopLogger = { debug: noop, info: noop, warn: noop, error: noop };

describe("MigrationService", () => {
  test("testMigration", async () => {
    await orquestrator.wipeDatabase();
    const migrationCount = 25;
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
      count: 6,
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

  test("AI generation migration preserves legacy chat and message information", async () => {
    await orquestrator.clearDatabase();
    await runner({
      databaseUrl: orquestrator.databaseConfig.connectionString,
      dir: Paths.migrationsDir(),
      direction: "down",
      migrationsTable: "pgmigrations",
      count: 2,
      noLock: true,
      logger: noopLogger,
    });
    const chatId = crypto.randomUUID();
    const turnId = crypto.randomUUID();
    const toolCallId = crypto.randomUUID();
    const toolResultId = crypto.randomUUID();
    const answerId = crypto.randomUUID();
    const createdAt = new Date("2026-07-30T12:00:00.000Z");
    await orquestrator.database.sql`
      INSERT INTO chats (
        id,
        channel,
        web_address,
        created_at,
        updated_at,
        is_deleted
      )
      VALUES (
        ${chatId},
        ${"Web"},
        ${"legacy@example.com"},
        ${createdAt},
        ${createdAt},
        ${false}
      )
    `;
    await orquestrator.database.sql`
      INSERT INTO messages (
        id,
        id_chat,
        turn_id,
        role,
        audience,
        content,
        channel_message_id,
        created_at,
        updated_at
      )
      VALUES
        (
          ${turnId},
          ${chatId},
          ${turnId},
          ${"User"},
          ${"Both"},
          ${orquestrator.database.json({ type: "text", text: "List todos" })},
          ${"legacy-user-message"},
          ${createdAt},
          ${createdAt}
        ),
        (
          ${toolCallId},
          ${chatId},
          ${turnId},
          ${"Assistant"},
          ${"Model"},
          ${orquestrator.database.json({
            type: "toolCall",
            callId: "call-1",
            name: "list_todos",
            arguments: { status: "Pending" },
          })},
          ${null},
          ${createdAt},
          ${createdAt}
        ),
        (
          ${toolResultId},
          ${chatId},
          ${turnId},
          ${"Tool"},
          ${"Model"},
          ${orquestrator.database.json({
            type: "toolResult",
            callId: "call-1",
            outcome: { status: "succeeded", data: { count: 2 } },
          })},
          ${null},
          ${createdAt},
          ${createdAt}
        ),
        (
          ${answerId},
          ${chatId},
          ${turnId},
          ${"Assistant"},
          ${"Both"},
          ${orquestrator.database.json({
            type: "text",
            text: "You have two pending todos.",
          })},
          ${null},
          ${createdAt},
          ${createdAt}
        )
    `;
    const legacyChat = await orquestrator.database.sql`
      SELECT
        id,
        id_user,
        channel,
        whatsapp_address,
        web_address,
        conversation_summary,
        created_at,
        updated_at,
        is_deleted
      FROM chats
      WHERE id = ${chatId}
    `;
    const legacyMessages = await orquestrator.database.sql`
      SELECT
        id,
        id_chat,
        turn_id,
        sequence,
        role,
        audience,
        content,
        channel_message_id,
        created_at,
        updated_at
      FROM messages
      WHERE id_chat = ${chatId}
      ORDER BY sequence
    `;

    await orquestrator.migrationService.runPendingMigrations(
      orquestrator.authConfig.hashPassword,
    );

    const migratedChat = await orquestrator.database.sql`
      SELECT
        id,
        id_user,
        channel,
        whatsapp_address,
        web_address,
        conversation_summary,
        created_at,
        updated_at,
        is_deleted
      FROM chats
      WHERE id = ${chatId}
    `;
    const migratedMessages = await orquestrator.database.sql`
      SELECT
        id,
        id_chat,
        turn_id,
        sequence,
        role,
        audience,
        content,
        channel_message_id,
        created_at,
        updated_at
      FROM messages
      WHERE id_chat = ${chatId}
      ORDER BY sequence
    `;
    const generationLinks = await orquestrator.database.sql<
      { id: string; generation_id: string | null }[]
    >`
      SELECT id, generation_id
      FROM messages
      WHERE id_chat = ${chatId}
      ORDER BY sequence
    `;
    const generations = await orquestrator.database.sql<
      {
        provider: string | null;
        model: string | null;
        finish_reason: string;
      }[]
    >`
      SELECT provider, model, finish_reason
      FROM ai_generations
      WHERE id_chat = ${chatId}
      ORDER BY sequence
    `;
    const reasoningEffort = await orquestrator.database.sql<
      { reasoning_effort: string }[]
    >`
      SELECT reasoning_effort
      FROM chats
      WHERE id = ${chatId}
    `;

    expect(migratedChat).toEqual(legacyChat);
    expect(migratedMessages).toEqual(legacyMessages);
    expect(generations).toEqual([
      { provider: null, model: null, finish_reason: "toolUse" },
      { provider: null, model: null, finish_reason: "stop" },
    ]);
    expect(generationLinks[0]?.generation_id).toBeNull();
    expect(generationLinks[1]?.generation_id).toBeDefined();
    expect(generationLinks[2]?.generation_id).toBe(
      generationLinks[1]?.generation_id,
    );
    expect(generationLinks[3]?.generation_id).toBeDefined();
    expect(generationLinks[3]?.generation_id).not.toBe(
      generationLinks[1]?.generation_id,
    );
    expect(reasoningEffort).toEqual([{ reasoning_effort: "off" }]);
  });
});
