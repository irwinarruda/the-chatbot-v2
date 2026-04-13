/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`ALTER TABLE users DROP COLUMN email`);
}
