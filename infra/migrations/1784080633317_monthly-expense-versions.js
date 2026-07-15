/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function up(pgm) {
  pgm.sql(`
    CREATE TABLE monthly_expense_versions (
      id_monthly_expense UUID NOT NULL
        REFERENCES monthly_expenses(id) ON DELETE CASCADE,
      month DATE NOT NULL,
      name VARCHAR(160) NOT NULL,
      expected_amount NUMERIC(12, 2),
      due_day SMALLINT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (id_monthly_expense, month),
      CONSTRAINT monthly_expense_versions_month_start
        CHECK (month = date_trunc('month', month)::date),
      CONSTRAINT monthly_expense_versions_expected_amount_positive
        CHECK (expected_amount IS NULL OR expected_amount > 0),
      CONSTRAINT monthly_expense_versions_due_day_valid
        CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31)
    )
  `);
  pgm.sql(`
    INSERT INTO monthly_expense_versions (
      id_monthly_expense,
      month,
      name,
      expected_amount,
      due_day,
      created_at,
      updated_at
    )
    SELECT
      expense.id,
      LEAST(
        date_trunc(
          'month',
          expense.created_at AT TIME ZONE 'America/Sao_Paulo'
        )::date,
        COALESCE(
          payment.first_month,
          date_trunc(
            'month',
            expense.created_at AT TIME ZONE 'America/Sao_Paulo'
          )::date
        )
      ),
      expense.name,
      expense.expected_amount,
      expense.due_day,
      expense.created_at,
      expense.updated_at
    FROM monthly_expenses expense
    LEFT JOIN LATERAL (
      SELECT MIN(month) AS first_month
      FROM monthly_expense_payments
      WHERE id_monthly_expense = expense.id
    ) payment ON true
  `);
}

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export function down(pgm) {
  pgm.sql(`DROP TABLE monthly_expense_versions`);
}
