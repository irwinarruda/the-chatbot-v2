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
    CREATE TABLE notes (
      id UUID PRIMARY KEY,
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id_source_message UUID REFERENCES messages(id) ON DELETE SET NULL,
      name VARCHAR(160) NOT NULL,
      markdown TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
  pgm.sql(
    `CREATE INDEX notes_id_user_updated_at_idx ON notes (id_user, updated_at DESC)`,
  );
  pgm.sql(
    `CREATE INDEX notes_id_source_message_idx ON notes (id_source_message)`,
  );
  pgm.sql(`
    CREATE UNIQUE INDEX notes_id_user_name_unique_idx
    ON notes (id_user, LOWER(name))
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DROP TABLE notes`);
};
