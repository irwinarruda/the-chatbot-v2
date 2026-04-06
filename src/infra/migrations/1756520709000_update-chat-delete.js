/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(
    `ALTER TABLE chats ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false`,
  );
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`ALTER TABLE chats DROP COLUMN is_deleted`);
}
