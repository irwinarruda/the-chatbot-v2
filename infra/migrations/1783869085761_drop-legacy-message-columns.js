/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function up(pgm) {
  pgm.sql(`
    UPDATE messages SET content = (content #>> '{}')::jsonb
    WHERE jsonb_typeof(content) = 'string'
  `);
  pgm.sql(`
    UPDATE chats SET conversation_summary = (conversation_summary #>> '{}')::jsonb
    WHERE conversation_summary IS NOT NULL
    AND jsonb_typeof(conversation_summary) = 'string'
  `);
}

export function down() {}
