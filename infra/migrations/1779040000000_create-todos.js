/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE todos (
      id UUID PRIMARY KEY,
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id_source_message UUID REFERENCES messages(id) ON DELETE SET NULL,
      name VARCHAR(160) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_date TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
  pgm.sql(`CREATE INDEX todos_id_user_idx ON todos (id_user)`);
  pgm.sql(`
    CREATE INDEX todos_id_source_message_idx ON todos (id_source_message)
  `);
  pgm.sql(`
    CREATE INDEX todos_id_user_due_date_idx ON todos (id_user, due_date)
  `);
  pgm.sql(`
    CREATE INDEX todos_id_user_status_idx ON todos (id_user, status)
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP TABLE todos`);
}
