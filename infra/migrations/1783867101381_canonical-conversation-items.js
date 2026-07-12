/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function up(pgm) {
  pgm.sql(`ALTER TABLE messages ADD COLUMN sequence BIGINT`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN turn_id UUID`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN role VARCHAR(16)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN audience VARCHAR(16)`);
  pgm.sql(`ALTER TABLE messages ADD COLUMN content JSONB`);

  pgm.sql(`
    UPDATE messages SET sequence = numbered.rn
    FROM (
      SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
      FROM messages
    ) numbered
    WHERE messages.id = numbered.id
  `);
  pgm.sql(`CREATE SEQUENCE messages_sequence_seq OWNED BY messages.sequence`);
  pgm.sql(`
    SELECT setval(
      'messages_sequence_seq',
      COALESCE((SELECT MAX(sequence) FROM messages), 0) + 1,
      false
    )
  `);
  pgm.sql(`
    ALTER TABLE messages
    ALTER COLUMN sequence SET DEFAULT nextval('messages_sequence_seq')
  `);

  pgm.sql(`UPDATE messages SET turn_id = id WHERE user_type = 'User'`);
  pgm.sql(`
    UPDATE messages m SET turn_id = COALESCE(
      (
        SELECT u.id FROM messages u
        WHERE u.id_chat = m.id_chat
        AND u.user_type = 'User'
        AND (u.created_at, u.id) <= (m.created_at, m.id)
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT 1
      ),
      m.id
    )
    WHERE m.user_type <> 'User'
  `);

  pgm.sql(`
    UPDATE messages SET role = CASE
      WHEN user_type = 'User' THEN 'User'
      ELSE 'Assistant'
    END
  `);
  pgm.sql(`UPDATE messages SET audience = 'Both'`);

  pgm.sql(`
    UPDATE messages SET content = CASE
      WHEN type = 'Audio' THEN jsonb_strip_nulls(jsonb_build_object(
        'type', 'audio',
        'mediaId', media_id,
        'mediaUrl', media_url,
        'mimeType', COALESCE(mime_type, 'audio/ogg'),
        'transcript', transcript
      ))
      WHEN type = 'Interactive' AND user_type = 'User' THEN jsonb_build_object(
        'type', 'button',
        'text', COALESCE(button_reply, '')
      )
      WHEN type = 'Interactive' THEN jsonb_strip_nulls(jsonb_build_object(
        'type', 'button',
        'text', COALESCE(text, ''),
        'options', CASE
          WHEN button_reply_options IS NULL THEN NULL
          ELSE to_jsonb(string_to_array(button_reply_options, ','))
        END
      ))
      ELSE jsonb_build_object('type', 'text', 'text', COALESCE(text, ''))
    END
  `);

  pgm.sql(`ALTER TABLE messages ALTER COLUMN sequence SET NOT NULL`);

  pgm.sql(`CREATE UNIQUE INDEX "UX_messages_sequence" ON messages (sequence)`);
  pgm.sql(
    `CREATE INDEX "IX_messages_chat_sequence" ON messages (id_chat, sequence)`,
  );
  pgm.sql(
    `CREATE INDEX "IX_messages_chat_turn" ON messages (id_chat, turn_id, sequence)`,
  );
  pgm.sql(`
    CREATE UNIQUE INDEX "UX_messages_chat_tool_item"
    ON messages (id_chat, turn_id, (content->>'type'), (content->>'callId'))
    WHERE content->>'type' IN ('toolCall', 'toolResult')
  `);

  pgm.sql(`ALTER TABLE chats ADD COLUMN conversation_summary JSONB`);
  pgm.sql(`
    UPDATE chats c SET conversation_summary = jsonb_build_object(
      'userProfile', jsonb_build_array(c.summary),
      'durableFacts', '[]'::jsonb,
      'compactedThroughSequence', m.sequence
    )
    FROM messages m
    WHERE c.summary IS NOT NULL
    AND c.summarized_until_id IS NOT NULL
    AND m.id = c.summarized_until_id
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`ALTER TABLE chats DROP COLUMN conversation_summary`);
  pgm.sql(`DROP INDEX "UX_messages_chat_tool_item"`);
  pgm.sql(`DROP INDEX "IX_messages_chat_turn"`);
  pgm.sql(`DROP INDEX "IX_messages_chat_sequence"`);
  pgm.sql(`DROP INDEX "UX_messages_sequence"`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN content`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN audience`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN role`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN turn_id`);
  pgm.sql(`ALTER TABLE messages DROP COLUMN sequence`);
}
