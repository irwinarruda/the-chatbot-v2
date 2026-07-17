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
      DROP COLUMN phone_number
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE chats
      ADD COLUMN phone_number VARCHAR(20)
  `);
  pgm.sql(`
    UPDATE chats
    SET phone_number = whatsapp_address
    WHERE phone_number IS NULL
      AND whatsapp_address IS NOT NULL
      AND whatsapp_address ~ '^[0-9]+$'
  `);
};
