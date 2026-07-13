/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function up(pgm) {
  pgm.sql(`
    ALTER TABLE messages
    DROP COLUMN type,
    DROP COLUMN user_type,
    DROP COLUMN text,
    DROP COLUMN button_reply,
    DROP COLUMN button_reply_options,
    DROP COLUMN media_id,
    DROP COLUMN media_url,
    DROP COLUMN mime_type,
    DROP COLUMN transcript
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`
    ALTER TABLE messages
    ADD COLUMN type VARCHAR(11),
    ADD COLUMN user_type VARCHAR(4),
    ADD COLUMN text VARCHAR(10000),
    ADD COLUMN button_reply VARCHAR(10000),
    ADD COLUMN button_reply_options VARCHAR(100),
    ADD COLUMN media_id VARCHAR(1000),
    ADD COLUMN media_url VARCHAR(1000),
    ADD COLUMN mime_type VARCHAR(100),
    ADD COLUMN transcript TEXT
  `);
  pgm.sql(`
    UPDATE messages SET
      type = CASE content->>'type'
        WHEN 'audio' THEN 'Audio'
        WHEN 'button' THEN 'Interactive'
        ELSE 'Text'
      END,
      user_type = CASE role WHEN 'User' THEN 'User' ELSE 'Bot' END,
      text = CASE
        WHEN content->>'type' = 'text' THEN left(content->>'text', 10000)
        WHEN content->>'type' = 'button' AND role <> 'User'
          THEN left(content->>'text', 10000)
        ELSE NULL
      END,
      button_reply = CASE
        WHEN content->>'type' = 'button' AND role = 'User'
          THEN left(content->>'text', 10000)
        ELSE NULL
      END,
      button_reply_options = CASE
        WHEN jsonb_typeof(content->'options') = 'array' THEN left(
          (
            SELECT string_agg(option, ',' ORDER BY position)
            FROM jsonb_array_elements_text(content->'options')
              WITH ORDINALITY AS options(option, position)
          ),
          100
        )
        ELSE NULL
      END,
      media_id = CASE
        WHEN content->>'type' = 'audio'
          THEN left(content->>'mediaId', 1000)
        ELSE NULL
      END,
      media_url = CASE
        WHEN content->>'type' = 'audio'
          THEN left(content->>'mediaUrl', 1000)
        ELSE NULL
      END,
      mime_type = CASE
        WHEN content->>'type' = 'audio'
          THEN left(content->>'mimeType', 100)
        ELSE NULL
      END,
      transcript = CASE
        WHEN content->>'type' = 'audio' THEN content->>'transcript'
        ELSE NULL
      END
  `);
  pgm.sql(`
    ALTER TABLE messages
    ALTER COLUMN type SET NOT NULL,
    ALTER COLUMN user_type SET NOT NULL
  `);
}
