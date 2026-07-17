/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE google_auth_challenges (
      id UUID PRIMARY KEY,
      token_hash BYTEA UNIQUE NOT NULL,
      channel_address VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
  pgm.sql(`
    CREATE INDEX "IX_google_auth_challenges_expires_at"
    ON google_auth_challenges (expires_at)
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TABLE google_auth_challenges`);
};
