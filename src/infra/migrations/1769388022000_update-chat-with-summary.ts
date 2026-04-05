import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE chats ADD COLUMN summary TEXT`);
  pgm.sql(`ALTER TABLE chats ADD COLUMN summarized_until_id UUID`);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE chats DROP COLUMN summarized_until_id`);
  pgm.sql(`ALTER TABLE chats DROP COLUMN summary`);
}
