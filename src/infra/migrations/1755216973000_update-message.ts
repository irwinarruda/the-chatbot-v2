import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE messages ADD COLUMN button_reply VARCHAR(10000)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN button_reply_options VARCHAR(100)`);
  pgm.sql(
    `ALTER TABLE messages ADD COLUMN type VARCHAR(11) NOT NULL DEFAULT 'text'`,
  );
  pgm.sql(`ALTER TABLE messages ADD COLUMN id_provider VARCHAR(1000)`);
  pgm.sql(
    `CREATE UNIQUE INDEX ix_messages_id_provider ON messages (id_provider) WHERE id_provider IS NOT NULL`,
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP INDEX ix_messages_id_provider`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN id_provider`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN type`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN button_reply_options`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN button_reply`);
}
