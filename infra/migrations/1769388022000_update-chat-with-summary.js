/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`ALTER TABLE chats ADD COLUMN summary TEXT`);
  pgm.sql(`ALTER TABLE chats ADD COLUMN summarized_until_id UUID`);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`ALTER TABLE chats DROP COLUMN summarized_until_id`);
  pgm.sql(`ALTER TABLE chats DROP COLUMN summary`);
}
