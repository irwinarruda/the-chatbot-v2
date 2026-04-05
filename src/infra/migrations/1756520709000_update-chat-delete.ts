import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(
    `ALTER TABLE chats ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false`,
  );
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE chats DROP COLUMN is_deleted`);
}
