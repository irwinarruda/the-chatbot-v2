/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`ALTER TABLE messages ADD COLUMN button_reply VARCHAR(10000)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN button_reply_options VARCHAR(100)`);
  pgm.sql(
    `ALTER TABLE messages ADD COLUMN type VARCHAR(11) NOT NULL DEFAULT 'Text'`,
  );
  pgm.sql(`ALTER TABLE messages ADD COLUMN id_provider VARCHAR(1000)`);
  pgm.sql(
    `CREATE UNIQUE INDEX ix_messages_id_provider ON messages (id_provider) WHERE id_provider IS NOT NULL`,
  );
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP INDEX ix_messages_id_provider`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN id_provider`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN type`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN button_reply_options`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN button_reply`);
}
