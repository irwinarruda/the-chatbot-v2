/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE google_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token VARCHAR(500) NOT NULL,
      refresh_token VARCHAR(500) NOT NULL,
      expires_in_seconds BIGINT,
      expiration_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
    )
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP TABLE google_credentials`);
}
