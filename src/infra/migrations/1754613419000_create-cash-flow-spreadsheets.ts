import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE cash_flow_spreadsheets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id_sheet VARCHAR(100) NOT NULL,
      type VARCHAR(6) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    )
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE cash_flow_spreadsheets`);
}
