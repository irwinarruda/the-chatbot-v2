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
    CREATE TABLE artifacts (
      id UUID PRIMARY KEY,
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(160) NOT NULL,
      visibility VARCHAR(16) NOT NULL,
      source_html TEXT NOT NULL,
      rendered_html TEXT NOT NULL,
      renderer_version VARCHAR(32) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT artifacts_visibility_check CHECK (
        visibility IN ('private', 'public')
      ),
      CONSTRAINT artifacts_source_size_check CHECK (
        octet_length(source_html) <= 1048576
      ),
      CONSTRAINT artifacts_rendered_size_check CHECK (
        octet_length(rendered_html) <= 4194304
      ),
      CONSTRAINT artifacts_version_check CHECK (version > 0)
    )
  `);
  pgm.sql(`
    CREATE INDEX artifacts_id_user_updated_at_idx
    ON artifacts (id_user, updated_at DESC)
  `);
  pgm.sql(`
    CREATE TABLE artifact_upload_tokens (
      id_user UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      token_hash BYTEA NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL,
      last_used_at TIMESTAMPTZ
    )
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TABLE artifact_upload_tokens`);
  pgm.sql(`DROP TABLE artifacts`);
};
