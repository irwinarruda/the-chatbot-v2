import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE messages ADD COLUMN media_url VARCHAR(1000)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN mime_type VARCHAR(100)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN transcript TEXT`);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE messages DROP COLUMN transcript`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN mime_type`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN media_url`);
}
