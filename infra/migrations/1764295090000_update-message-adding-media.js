/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`ALTER TABLE messages ADD COLUMN media_url VARCHAR(1000)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN mime_type VARCHAR(100)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN transcript TEXT`);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`ALTER TABLE messages DROP COLUMN transcript`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN mime_type`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN media_url`);
}
