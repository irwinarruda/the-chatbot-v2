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
    DROP INDEX IF EXISTS monthly_expenses_active_user_idx
  `);
  pgm.sql(`
    ALTER TABLE monthly_expenses
      DROP COLUMN name,
      DROP COLUMN expected_amount,
      DROP COLUMN due_day
  `);
  pgm.sql(`
    CREATE INDEX monthly_expenses_active_user_idx
    ON monthly_expenses (id_user)
    WHERE archived_at IS NULL
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS monthly_expenses_active_user_idx
  `);
  pgm.sql(`
    ALTER TABLE monthly_expenses
      ADD COLUMN name VARCHAR(160),
      ADD COLUMN expected_amount NUMERIC(12, 2),
      ADD COLUMN due_day SMALLINT
  `);
  pgm.sql(`
    UPDATE monthly_expenses expense
    SET
      name = version.name,
      expected_amount = version.expected_amount,
      due_day = version.due_day
    FROM (
      SELECT DISTINCT ON (id_monthly_expense)
        id_monthly_expense,
        name,
        expected_amount,
        due_day
      FROM monthly_expense_versions
      ORDER BY id_monthly_expense, month DESC
    ) version
    WHERE expense.id = version.id_monthly_expense
  `);
  pgm.sql(`
    UPDATE monthly_expenses
    SET name = 'Untitled'
    WHERE name IS NULL
  `);
  pgm.sql(`
    ALTER TABLE monthly_expenses
      ALTER COLUMN name SET NOT NULL,
      ADD CONSTRAINT monthly_expenses_expected_amount_positive
        CHECK (expected_amount IS NULL OR expected_amount > 0),
      ADD CONSTRAINT monthly_expenses_due_day_valid
        CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31)
  `);
  pgm.sql(`
    CREATE INDEX monthly_expenses_active_user_idx
    ON monthly_expenses (id_user, due_day, name)
    WHERE archived_at IS NULL
  `);
};
