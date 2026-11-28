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
    CREATE TABLE mcp_oauth_clients (
      id UUID PRIMARY KEY,
      name VARCHAR(200),
      redirect_uris TEXT[] NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT mcp_oauth_clients_redirect_uris_check CHECK (
        cardinality(redirect_uris) BETWEEN 1 AND 10
      )
    )
  `);
  pgm.sql(`
    CREATE TABLE mcp_oauth_codes (
      code_hash BYTEA PRIMARY KEY,
      id_client UUID NOT NULL REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE,
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redirect_uri TEXT NOT NULL,
      code_challenge VARCHAR(128) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
  pgm.sql(`
    CREATE TABLE mcp_oauth_tokens (
      token_hash BYTEA PRIMARY KEY,
      kind VARCHAR(16) NOT NULL,
      id_client UUID NOT NULL REFERENCES mcp_oauth_clients(id) ON DELETE CASCADE,
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      CONSTRAINT mcp_oauth_tokens_kind_check CHECK (
        kind IN ('access', 'refresh')
      )
    )
  `);
  pgm.sql(`
    CREATE INDEX mcp_oauth_tokens_id_user_idx ON mcp_oauth_tokens (id_user)
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TABLE mcp_oauth_tokens`);
  pgm.sql(`DROP TABLE mcp_oauth_codes`);
  pgm.sql(`DROP TABLE mcp_oauth_clients`);
};
