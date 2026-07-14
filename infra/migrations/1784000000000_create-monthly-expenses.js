/** @param {import('node-pg-migrate').MigrationBuilder} pgm */

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE monthly_expenses (
      id UUID PRIMARY KEY,
      id_user UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      expected_amount NUMERIC(12, 2),
      due_day SMALLINT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ,
      CONSTRAINT monthly_expenses_expected_amount_positive
        CHECK (expected_amount IS NULL OR expected_amount > 0),
      CONSTRAINT monthly_expenses_due_day_valid
        CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31)
    )
  `);
  pgm.sql(`
    CREATE INDEX monthly_expenses_active_user_idx
    ON monthly_expenses (id_user, due_day, name)
    WHERE archived_at IS NULL
  `);
  pgm.sql(`
    CREATE TABLE monthly_expense_payments (
      id_monthly_expense UUID NOT NULL
        REFERENCES monthly_expenses(id) ON DELETE CASCADE,
      month DATE NOT NULL,
      paid_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (id_monthly_expense, month),
      CONSTRAINT monthly_expense_payments_month_start
        CHECK (month = date_trunc('month', month)::date)
    )
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP TABLE monthly_expense_payments`);
  pgm.sql(`DROP TABLE monthly_expenses`);
}
