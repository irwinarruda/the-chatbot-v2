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
    CREATE TABLE ai_provider_credentials (
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id VARCHAR(100) NOT NULL,
      credential_type VARCHAR(16) NOT NULL,
      credential_envelope JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      PRIMARY KEY (id_user, provider_id),
      CONSTRAINT ai_provider_credentials_type_check CHECK (
        credential_type IN ('api_key', 'oauth')
      )
    )
  `);
  pgm.sql(`
    CREATE TABLE ai_model_preferences (
      id_user UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      provider_id VARCHAR(100) NOT NULL,
      model_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    )
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TABLE ai_model_preferences`);
  pgm.sql(`DROP TABLE ai_provider_credentials`);
};
