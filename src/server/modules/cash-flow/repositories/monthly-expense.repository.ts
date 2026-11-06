import { MonthlyExpense } from "~/domain/cash-flow/monthly-expense";
import type { MonthlyExpenseItemDTO } from "~/domain/cash-flow/monthly-expense-commands";
import type { DatabaseGateway } from "~/server/shared/database/database";

export class MonthlyExpenseRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async list(idUser: string, month: string): Promise<MonthlyExpenseItemDTO[]> {
    const monthDate = `${month}-01`;
    const rows = await this.database.sql<DbMonthlyExpenseItem[]>`
      SELECT
        e.id,
        e.id_user,
        version.name,
        version.expected_amount,
        version.due_day,
        version.category,
        version.default_bank_account,
        e.created_at,
        version.updated_at,
        p.paid_at
      FROM monthly_expenses e
      INNER JOIN LATERAL (
        SELECT
          v.name,
          v.expected_amount,
          v.due_day,
          v.category,
          v.default_bank_account,
          v.updated_at
        FROM monthly_expense_versions v
        WHERE v.id_monthly_expense = e.id
        AND v.month <= ${monthDate}::date
        ORDER BY v.month DESC
        LIMIT 1
      ) version ON true
      LEFT JOIN monthly_expense_payments p
        ON p.id_monthly_expense = e.id
        AND p.month = ${monthDate}::date
      WHERE e.id_user = ${idUser}
      AND (
        e.archived_at IS NULL
        OR date_trunc(
          'month',
          e.archived_at AT TIME ZONE 'America/Sao_Paulo'
        )::date > ${monthDate}::date
      )
      ORDER BY
        CASE WHEN p.paid_at IS NULL THEN 0 ELSE 1 END,
        CASE WHEN version.due_day IS NULL THEN 1 ELSE 0 END,
        version.due_day ASC,
        version.name ASC
    `;
    return rows.map((row) => toItem(row, month));
  }

  async get(
    idUser: string,
    id: string,
    month: string,
  ): Promise<MonthlyExpenseItemDTO | undefined> {
    const monthDate = `${month}-01`;
    const rows = await this.database.sql<DbMonthlyExpenseItem[]>`
      SELECT
        e.id,
        e.id_user,
        version.name,
        version.expected_amount,
        version.due_day,
        version.category,
        version.default_bank_account,
        e.created_at,
        version.updated_at,
        p.paid_at
      FROM monthly_expenses e
      INNER JOIN LATERAL (
        SELECT
          v.name,
          v.expected_amount,
          v.due_day,
          v.category,
          v.default_bank_account,
          v.updated_at
        FROM monthly_expense_versions v
        WHERE v.id_monthly_expense = e.id
        AND v.month <= ${monthDate}::date
        ORDER BY v.month DESC
        LIMIT 1
      ) version ON true
      LEFT JOIN monthly_expense_payments p
        ON p.id_monthly_expense = e.id
        AND p.month = ${monthDate}::date
      WHERE e.id = ${id}
      AND e.id_user = ${idUser}
      AND (
        e.archived_at IS NULL
        OR date_trunc(
          'month',
          e.archived_at AT TIME ZONE 'America/Sao_Paulo'
        )::date > ${monthDate}::date
      )
    `;
    return rows.map((row) => toItem(row, month))[0];
  }

  async create(expense: MonthlyExpense, month: string): Promise<void> {
    await this.database.transaction(async (sql) => {
      await sql`
        INSERT INTO monthly_expenses (
          id,
          id_user,
          created_at,
          updated_at
        ) VALUES (
          ${expense.id},
          ${expense.idUser},
          ${expense.createdAt},
          ${expense.updatedAt}
        )
      `;
      await sql`
        INSERT INTO monthly_expense_versions (
          id_monthly_expense,
          month,
          name,
          expected_amount,
          due_day,
          category,
          default_bank_account,
          created_at,
          updated_at
        ) VALUES (
          ${expense.id},
          ${`${month}-01`}::date,
          ${expense.name},
          ${expense.expectedAmount ?? null},
          ${expense.dueDay ?? null},
          ${expense.category ?? null},
          ${expense.defaultBankAccount ?? null},
          ${expense.createdAt},
          ${expense.updatedAt}
        )
      `;
    });
  }

  async saveVersion(expense: MonthlyExpense, month: string): Promise<void> {
    const monthDate = `${month}-01`;
    await this.database.transaction(async (sql) => {
      await sql`
        INSERT INTO monthly_expense_versions (
          id_monthly_expense,
          month,
          name,
          expected_amount,
          due_day,
          category,
          default_bank_account,
          created_at,
          updated_at
        ) VALUES (
          ${expense.id},
          ${monthDate}::date,
          ${expense.name},
          ${expense.expectedAmount ?? null},
          ${expense.dueDay ?? null},
          ${expense.category ?? null},
          ${expense.defaultBankAccount ?? null},
          ${expense.updatedAt},
          ${expense.updatedAt}
        )
        ON CONFLICT (id_monthly_expense, month) DO UPDATE SET
          name = EXCLUDED.name,
          expected_amount = EXCLUDED.expected_amount,
          due_day = EXCLUDED.due_day,
          category = EXCLUDED.category,
          default_bank_account = EXCLUDED.default_bank_account,
          updated_at = EXCLUDED.updated_at
      `;
      await sql`
        UPDATE monthly_expenses SET
          updated_at = ${expense.updatedAt}
        WHERE id = ${expense.id}
        AND id_user = ${expense.idUser}
      `;
    });
  }

  async savePaymentDetails(
    expense: MonthlyExpense,
    month: string,
  ): Promise<void> {
    const monthDate = `${month}-01`;
    await this.database.sql`
      UPDATE monthly_expense_versions SET
        category = ${expense.category ?? null},
        default_bank_account = ${expense.defaultBankAccount ?? null},
        updated_at = ${expense.updatedAt}
      WHERE id_monthly_expense = ${expense.id}
      AND month = (
        SELECT MAX(month)
        FROM monthly_expense_versions
        WHERE id_monthly_expense = ${expense.id}
        AND month <= ${monthDate}::date
      )
    `;
  }

  async archive(idUser: string, id: string, now: Date): Promise<boolean> {
    const result = await this.database.sql`
      UPDATE monthly_expenses SET
        archived_at = ${now},
        updated_at = ${now}
      WHERE id = ${id}
      AND id_user = ${idUser}
      AND archived_at IS NULL
    `;
    return result.count > 0;
  }

  async markPaid(
    id: string,
    month: string,
    paidAt: Date | undefined,
    now: Date,
  ): Promise<void> {
    await this.database.sql`
      INSERT INTO monthly_expense_payments (
        id_monthly_expense,
        month,
        paid_at
      ) VALUES (
        ${id},
        ${`${month}-01`}::date,
        ${paidAt ?? now}
      )
      ON CONFLICT (id_monthly_expense, month) DO UPDATE SET
        paid_at = COALESCE(${paidAt ?? null}, monthly_expense_payments.paid_at)
    `;
  }

  async unmarkPaid(id: string, month: string): Promise<void> {
    await this.database.sql`
      DELETE FROM monthly_expense_payments
      WHERE id_monthly_expense = ${id}
      AND month = ${`${month}-01`}::date
    `;
  }
}

function toItem(
  row: DbMonthlyExpenseItem,
  month: string,
): MonthlyExpenseItemDTO {
  return {
    expense: toExpense(row),
    month,
    isPaid: row.paid_at !== null,
    paidAt: row.paid_at ?? undefined,
  };
}

function toExpense(row: DbMonthlyExpense): MonthlyExpense {
  return MonthlyExpense.restore({
    id: row.id,
    idUser: row.id_user,
    name: row.name,
    expectedAmount:
      row.expected_amount === null ? undefined : Number(row.expected_amount),
    dueDay: row.due_day ?? undefined,
    category: row.category ?? undefined,
    defaultBankAccount: row.default_bank_account ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

interface DbMonthlyExpense {
  id: string;
  id_user: string;
  name: string;
  expected_amount: string | null;
  due_day: number | null;
  category: string | null;
  default_bank_account: string | null;
  created_at: Date;
  updated_at: Date;
}

interface DbMonthlyExpenseItem extends DbMonthlyExpense {
  paid_at: Date | null;
}
