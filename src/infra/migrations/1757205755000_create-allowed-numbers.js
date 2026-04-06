/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE allowed_numbers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      CONSTRAINT uc_allowed_numbers_phone_number UNIQUE (phone_number)
    )
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP TABLE allowed_numbers`);
}
