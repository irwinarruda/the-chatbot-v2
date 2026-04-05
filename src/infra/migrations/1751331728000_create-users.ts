import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(30) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      is_inactive BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      CONSTRAINT uc_users_phone_number UNIQUE (phone_number)
    )
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE users`);
}
