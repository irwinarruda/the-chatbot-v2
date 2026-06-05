/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`ALTER TABLE chats RENAME COLUMN type TO channel`);
  pgm.sql(
    `ALTER TABLE messages RENAME COLUMN id_provider TO channel_message_id`,
  );
  pgm.sql(
    `ALTER INDEX "IX_messages_id_provider" RENAME TO "IX_messages_channel_message_id"`,
  );
  pgm.sql(`ALTER TABLE users ADD COLUMN bsuid VARCHAR(255)`);
  pgm.sql(`ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL`);
  pgm.sql(`
    CREATE UNIQUE INDEX "UX_users_email_lower"
    ON users (lower(email))
    WHERE email IS NOT NULL
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX "UX_users_bsuid"
    ON users (bsuid)
    WHERE bsuid IS NOT NULL
  `);
  pgm.sql(`ALTER TABLE chats ALTER COLUMN phone_number DROP NOT NULL`);
  pgm.sql(`ALTER TABLE chats ADD COLUMN whatsapp_address VARCHAR(255)`);
  pgm.sql(`ALTER TABLE chats ADD COLUMN web_address VARCHAR(255)`);
  pgm.sql(`
    UPDATE chats
    SET whatsapp_address = phone_number
    WHERE channel = 'WhatsApp'
    AND whatsapp_address IS NULL
    AND phone_number IS NOT NULL
  `);
  pgm.sql(`
    UPDATE chats
    SET web_address = lower(u.email)
    FROM users u
    WHERE chats.id_user = u.id
    AND chats.channel = 'Web'
    AND chats.web_address IS NULL
    AND u.email IS NOT NULL
  `);
  pgm.sql(`
    CREATE INDEX "IX_chats_whatsapp_address_active"
    ON chats (whatsapp_address, created_at DESC)
    WHERE whatsapp_address IS NOT NULL AND is_deleted = false
  `);
  pgm.sql(`
    CREATE INDEX "IX_chats_web_address_active"
    ON chats (web_address, created_at DESC)
    WHERE web_address IS NOT NULL AND is_deleted = false
  `);
  pgm.sql(`
    CREATE INDEX "IX_chats_user_channel_active"
    ON chats (id_user, channel, created_at DESC)
    WHERE id_user IS NOT NULL AND is_deleted = false
  `);
  pgm.sql(`
    CREATE INDEX "IX_messages_id_chat_created_at"
    ON messages (id_chat, created_at)
  `);
  pgm.sql(
    `CREATE TABLE allowed_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel VARCHAR(20) NOT NULL,
      channel_address VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      CONSTRAINT ck_allowed_entries_channel
        CHECK (channel IN ('WhatsApp', 'Web'))
    )`,
  );
  pgm.sql(`
    INSERT INTO allowed_entries (id, channel, channel_address, created_at)
    SELECT
      allowed_numbers.id,
      'WhatsApp',
      allowed_numbers.phone_number,
      allowed_numbers.created_at
    FROM allowed_numbers
    WHERE allowed_numbers.phone_number IS NOT NULL
  `);
  pgm.sql(`
    CREATE UNIQUE INDEX "UX_allowed_entries_channel_address"
    ON allowed_entries (channel, channel_address)
  `);
  pgm.sql(`DROP TABLE allowed_numbers`);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`
    CREATE TABLE allowed_numbers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      phone_number VARCHAR(20) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      CONSTRAINT uc_allowed_numbers_phone_number UNIQUE (phone_number)
    )
  `);
  pgm.sql(`
    INSERT INTO allowed_numbers (id, phone_number, created_at)
    SELECT id, channel_address, created_at
    FROM allowed_entries
    WHERE channel = 'WhatsApp'
  `);
  pgm.sql(`DROP INDEX "UX_allowed_entries_channel_address"`);
  pgm.sql(`DROP TABLE allowed_entries`);
  pgm.sql(`DROP INDEX "IX_chats_user_channel_active"`);
  pgm.sql(`DROP INDEX "IX_chats_web_address_active"`);
  pgm.sql(`DROP INDEX "IX_chats_whatsapp_address_active"`);
  pgm.sql(`DROP INDEX "IX_messages_id_chat_created_at"`);
  pgm.sql(`ALTER TABLE chats DROP COLUMN web_address`);
  pgm.sql(`ALTER TABLE chats DROP COLUMN whatsapp_address`);
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM chats WHERE phone_number IS NULL) THEN
        RAISE EXCEPTION 'Cannot set chats.phone_number NOT NULL: null values exist';
      END IF;
      ALTER TABLE chats ALTER COLUMN phone_number SET NOT NULL;
    END $$
  `);
  pgm.sql(`DROP INDEX "UX_users_bsuid"`);
  pgm.sql(`DROP INDEX "UX_users_email_lower"`);
  pgm.sql(`ALTER TABLE users DROP COLUMN bsuid`);
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM users WHERE phone_number IS NULL) THEN
        RAISE EXCEPTION 'Cannot set phone_number NOT NULL: null values exist';
      END IF;
      ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;
    END $$
  `);
  pgm.sql(
    `ALTER INDEX "IX_messages_channel_message_id" RENAME TO "IX_messages_id_provider"`,
  );
  pgm.sql(
    `ALTER TABLE messages RENAME COLUMN channel_message_id TO id_provider`,
  );
  pgm.sql(`ALTER TABLE chats RENAME COLUMN channel TO type`);
}
