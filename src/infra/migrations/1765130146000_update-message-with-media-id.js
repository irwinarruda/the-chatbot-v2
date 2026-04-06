/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`ALTER TABLE messages ADD COLUMN media_id VARCHAR(1000)`);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`ALTER TABLE messages DROP COLUMN media_id`);
}
