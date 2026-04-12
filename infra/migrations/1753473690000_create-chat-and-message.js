/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_user UUID REFERENCES users(id) ON DELETE SET NULL,
      phone_number VARCHAR(20) NOT NULL,
      type VARCHAR(8) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    )
  `);
  pgm.sql(`
    CREATE TABLE messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_chat UUID NOT NULL REFERENCES chats(id) ON DELETE SET NULL,
      user_type VARCHAR(4) NOT NULL,
      text VARCHAR(10000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
    )
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP TABLE messages`);
  pgm.sql(`DROP TABLE chats`);
}
