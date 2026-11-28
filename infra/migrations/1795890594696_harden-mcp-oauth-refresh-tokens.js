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
    ALTER TABLE mcp_oauth_tokens
      ADD COLUMN id_family UUID NOT NULL DEFAULT gen_random_uuid(),
      ADD COLUMN used_at TIMESTAMPTZ
  `);
  pgm.sql(`
    CREATE INDEX mcp_oauth_tokens_id_family_idx
      ON mcp_oauth_tokens (id_family)
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DELETE FROM mcp_oauth_tokens`);
  pgm.sql(`DROP INDEX mcp_oauth_tokens_id_family_idx`);
  pgm.sql(`
    ALTER TABLE mcp_oauth_tokens
      DROP COLUMN used_at,
      DROP COLUMN id_family
  `);
};
