import type { MigrationBuilder } from "node-pg-migrate";

export function up(pgm: MigrationBuilder): void {
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

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE messages`);
  pgm.sql(`DROP TABLE chats`);
}
