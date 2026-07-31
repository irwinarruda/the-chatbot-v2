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
    ALTER TABLE chats
    ADD COLUMN reasoning_effort VARCHAR(16) NOT NULL DEFAULT 'off',
    ADD CONSTRAINT chats_reasoning_effort_check CHECK (
      reasoning_effort IN (
        'off',
        'minimal',
        'low',
        'medium',
        'high',
        'xhigh',
        'max'
      )
    )
  `);
  pgm.sql(`
    CREATE TABLE ai_generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence BIGSERIAL NOT NULL UNIQUE,
      id_chat UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      turn_id UUID NOT NULL,
      provider VARCHAR(100),
      model VARCHAR(255),
      api VARCHAR(100),
      response_model VARCHAR(255),
      response_id VARCHAR(1000),
      reasoning_effort VARCHAR(16) NOT NULL,
      finish_reason VARCHAR(32) NOT NULL,
      usage JSONB,
      diagnostics JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
      CONSTRAINT ai_generations_reasoning_effort_check CHECK (
        reasoning_effort IN (
          'off',
          'minimal',
          'low',
          'medium',
          'high',
          'xhigh',
          'max'
        )
      )
    )
  `);
  pgm.sql(`
    CREATE INDEX "IX_ai_generations_chat_turn_sequence"
    ON ai_generations (id_chat, turn_id, sequence)
  `);
  pgm.sql(`ALTER TABLE messages ADD COLUMN generation_id UUID`);
  pgm.sql(`
    CREATE TEMP TABLE legacy_generation_map ON COMMIT DROP AS
    WITH ordered_messages AS (
      SELECT
        id,
        id_chat,
        turn_id,
        sequence,
        role,
        content,
        created_at,
        lag(role) OVER (
          PARTITION BY id_chat, turn_id
          ORDER BY sequence
        ) AS previous_role
      FROM messages
    ),
    assistant_messages AS (
      SELECT
        *,
        sum(
          CASE WHEN previous_role IS DISTINCT FROM 'Assistant' THEN 1 ELSE 0 END
        ) OVER (
          PARTITION BY id_chat, turn_id
          ORDER BY sequence
        ) AS run_number
      FROM ordered_messages
      WHERE role = 'Assistant'
    )
    SELECT
      gen_random_uuid() AS id,
      id_chat,
      turn_id,
      run_number,
      min(sequence) AS first_sequence,
      max(sequence) AS last_sequence,
      CASE
        WHEN bool_or(content->>'type' = 'toolCall') THEN 'toolUse'
        ELSE 'stop'
      END AS finish_reason,
      min(created_at) AS created_at
    FROM assistant_messages
    GROUP BY id_chat, turn_id, run_number
  `);
  pgm.sql(`
    INSERT INTO ai_generations (
      id,
      id_chat,
      turn_id,
      reasoning_effort,
      finish_reason,
      created_at
    )
    SELECT
      id,
      id_chat,
      turn_id,
      'off',
      finish_reason,
      created_at
    FROM legacy_generation_map
    ORDER BY first_sequence
  `);
  pgm.sql(`
    UPDATE messages AS message
    SET generation_id = generation.id
    FROM legacy_generation_map AS generation
    WHERE message.id_chat = generation.id_chat
      AND message.turn_id = generation.turn_id
      AND message.role = 'Assistant'
      AND message.sequence BETWEEN
        generation.first_sequence AND generation.last_sequence
  `);
  pgm.sql(`
    UPDATE messages AS result
    SET generation_id = call.generation_id
    FROM messages AS call
    WHERE result.content->>'type' = 'toolResult'
      AND call.content->>'type' = 'toolCall'
      AND result.id_chat = call.id_chat
      AND result.turn_id = call.turn_id
      AND result.content->>'callId' = call.content->>'callId'
  `);
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM messages
        WHERE role = 'Assistant' AND generation_id IS NULL
      ) THEN
        RAISE EXCEPTION
          'AI generation backfill left assistant messages unlinked';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM messages
        WHERE content->>'type' = 'toolResult' AND generation_id IS NULL
      ) THEN
        RAISE EXCEPTION
          'AI generation backfill left tool results unlinked';
      END IF;
    END
    $$
  `);
  pgm.sql(`
    ALTER TABLE messages
    ADD CONSTRAINT messages_generation_id_fkey
    FOREIGN KEY (generation_id)
    REFERENCES ai_generations(id)
    ON DELETE SET NULL
  `);
  pgm.sql(`
    CREATE INDEX "IX_messages_generation_sequence"
    ON messages (generation_id, sequence)
    WHERE generation_id IS NOT NULL
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`DROP INDEX "IX_messages_generation_sequence"`);
  pgm.sql(`
    ALTER TABLE messages
    DROP CONSTRAINT messages_generation_id_fkey,
    DROP COLUMN generation_id
  `);
  pgm.sql(`DROP TABLE ai_generations`);
  pgm.sql(`
    ALTER TABLE chats
    DROP CONSTRAINT chats_reasoning_effort_check,
    DROP COLUMN reasoning_effort
  `);
};
