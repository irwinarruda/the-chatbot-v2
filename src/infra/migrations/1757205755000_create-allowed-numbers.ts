import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE allowed_numbers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      CONSTRAINT uc_allowed_numbers_phone_number UNIQUE (phone_number)
    )
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE allowed_numbers`);
}
