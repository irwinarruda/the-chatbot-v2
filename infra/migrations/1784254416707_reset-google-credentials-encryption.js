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
    DELETE FROM google_credentials;

    ALTER TABLE google_credentials
      DROP COLUMN access_token,
      DROP COLUMN refresh_token,
      ADD COLUMN token_envelope JSONB NOT NULL;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    DELETE FROM google_credentials;

    ALTER TABLE google_credentials
      DROP COLUMN token_envelope,
      ADD COLUMN access_token VARCHAR(500) NOT NULL,
      ADD COLUMN refresh_token VARCHAR(500) NOT NULL;
  `);
};
