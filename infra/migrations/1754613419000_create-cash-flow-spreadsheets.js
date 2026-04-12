/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
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

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP TABLE cash_flow_spreadsheets`);
}
