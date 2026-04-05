import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE messages ADD COLUMN media_id VARCHAR(1000)`);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE messages DROP COLUMN media_id`);
}
