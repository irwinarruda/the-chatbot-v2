import type {
  CreateMonthlyExpenseDTO,
  MonthlyExpenseItem,
  UpdateMonthlyExpenseDTO,
} from "~/modules/cash-flow/entities/dtos/MonthlyExpenseServiceDTO";
import { MonthlyExpense } from "~/modules/cash-flow/entities/MonthlyExpense";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

export class MonthlyExpenseService {
  constructor(
    private database: DatabaseGateway,
    private now: () => Date = () => new Date(),
  ) {}

  currentMonth(): string {
    return monthFormatter.format(this.now()).slice(0, 7);
  }

  async listMonthlyExpenses(
    idUser: string,
    month = this.currentMonth(),
  ): Promise<MonthlyExpenseItem[]> {
    this.validateMonth(month);
    const monthDate = `${month}-01`;
    const rows = await this.database.sql<DbMonthlyExpenseItem[]>`
      SELECT
        e.id,
        e.id_user,
        version.name,
        version.expected_amount,
        version.due_day,
        e.created_at,
        version.updated_at,
        p.paid_at
      FROM monthly_expenses e
      INNER JOIN LATERAL (
        SELECT
          v.name,
          v.expected_amount,
          v.due_day,
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
    return rows.map((row) => this.mapItem(row, month));
  }

  async createMonthlyExpense(
    dto: CreateMonthlyExpenseDTO,
  ): Promise<MonthlyExpenseItem> {
    const expense = new MonthlyExpense(dto);
    const month = dto.month ?? this.currentMonth();
    this.validateMonth(month);
    await this.database.transaction(async (sql) => {
      await sql`
        INSERT INTO monthly_expenses (
          id,
          id_user,
          name,
          expected_amount,
          due_day,
          created_at,
          updated_at
        ) VALUES (
          ${expense.id},
          ${expense.idUser},
          ${expense.name},
          ${expense.expectedAmount ?? null},
          ${expense.dueDay ?? null},
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
          created_at,
          updated_at
        ) VALUES (
          ${expense.id},
          ${`${month}-01`}::date,
          ${expense.name},
          ${expense.expectedAmount ?? null},
          ${expense.dueDay ?? null},
          ${expense.createdAt},
          ${expense.updatedAt}
        )
      `;
    });
    return this.getMonthlyExpense(dto.idUser, expense.id, month);
  }

  async updateMonthlyExpense(
    dto: UpdateMonthlyExpenseDTO,
  ): Promise<MonthlyExpenseItem> {
    const month = dto.month ?? this.currentMonth();
    this.validateMonth(month);
    const item = await this.getMonthlyExpense(dto.idUser, dto.id, month);
    const expense = item.expense;
    if (dto.name !== undefined) expense.rename(dto.name);
    if (dto.clearExpectedAmount) {
      expense.changeExpectedAmount(undefined);
    } else if (dto.expectedAmount !== undefined) {
      expense.changeExpectedAmount(dto.expectedAmount);
    }
    if (dto.clearDueDay) {
      expense.changeDueDay(undefined);
    } else if (dto.dueDay !== undefined) {
      expense.changeDueDay(dto.dueDay);
    }
    expense.updatedAt = this.now();
    const monthDate = `${month}-01`;
    await this.database.transaction(async (sql) => {
      await sql`
        INSERT INTO monthly_expense_versions (
          id_monthly_expense,
          month,
          name,
          expected_amount,
          due_day,
          created_at,
          updated_at
        ) VALUES (
          ${expense.id},
          ${monthDate}::date,
          ${expense.name},
          ${expense.expectedAmount ?? null},
          ${expense.dueDay ?? null},
          ${expense.updatedAt},
          ${expense.updatedAt}
        )
        ON CONFLICT (id_monthly_expense, month) DO UPDATE SET
          name = EXCLUDED.name,
          expected_amount = EXCLUDED.expected_amount,
          due_day = EXCLUDED.due_day,
          updated_at = EXCLUDED.updated_at
      `;
      await sql`
        UPDATE monthly_expenses SET
          name = ${expense.name},
          expected_amount = ${expense.expectedAmount ?? null},
          due_day = ${expense.dueDay ?? null},
          updated_at = ${expense.updatedAt}
        WHERE id = ${expense.id}
        AND id_user = ${expense.idUser}
        AND NOT EXISTS (
          SELECT 1
          FROM monthly_expense_versions
          WHERE id_monthly_expense = ${expense.id}
          AND month > ${monthDate}::date
        )
      `;
    });
    return this.getMonthlyExpense(dto.idUser, dto.id, month);
  }

  async archiveMonthlyExpense(idUser: string, id: string): Promise<void> {
    const now = this.now();
    const result = await this.database.sql`
      UPDATE monthly_expenses SET
        archived_at = ${now},
        updated_at = ${now}
      WHERE id = ${id}
      AND id_user = ${idUser}
      AND archived_at IS NULL
    `;
    if (result.count === 0) {
      throw new NotFoundException("Monthly expense not found");
    }
  }

  async setMonthlyExpensePaid(
    idUser: string,
    id: string,
    isPaid: boolean,
    month = this.currentMonth(),
  ): Promise<MonthlyExpenseItem> {
    this.validateMonth(month);
    await this.getMonthlyExpense(idUser, id, month);
    if (isPaid) {
      await this.database.sql`
        INSERT INTO monthly_expense_payments (
          id_monthly_expense,
          month,
          paid_at
        ) VALUES (
          ${id},
          ${`${month}-01`}::date,
          ${this.now()}
        )
        ON CONFLICT (id_monthly_expense, month) DO NOTHING
      `;
    } else {
      await this.database.sql`
        DELETE FROM monthly_expense_payments
        WHERE id_monthly_expense = ${id}
        AND month = ${`${month}-01`}::date
      `;
    }
    return this.getMonthlyExpense(idUser, id, month);
  }

  private async getMonthlyExpense(
    idUser: string,
    id: string,
    month = this.currentMonth(),
  ): Promise<MonthlyExpenseItem> {
    this.validateMonth(month);
    const monthDate = `${month}-01`;
    const rows = await this.database.sql<DbMonthlyExpenseItem[]>`
      SELECT
        e.id,
        e.id_user,
        version.name,
        version.expected_amount,
        version.due_day,
        e.created_at,
        version.updated_at,
        p.paid_at
      FROM monthly_expenses e
      INNER JOIN LATERAL (
        SELECT
          v.name,
          v.expected_amount,
          v.due_day,
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
    const row = rows[0];
    if (!row) throw new NotFoundException("Monthly expense not found");
    return this.mapItem(row, month);
  }

  private validateMonth(month: string): void {
    if (!MONTH_PATTERN.test(month)) {
      throw new ValidationException("Monthly expense month is invalid");
    }
  }

  private mapItem(
    row: DbMonthlyExpenseItem,
    month: string,
  ): MonthlyExpenseItem {
    return {
      expense: this.mapExpense(row),
      month,
      isPaid: row.paid_at !== null,
      paidAt: row.paid_at ?? undefined,
    };
  }

  private mapExpense(row: DbMonthlyExpense): MonthlyExpense {
    return MonthlyExpense.restore({
      id: row.id,
      idUser: row.id_user,
      name: row.name,
      expectedAmount:
        row.expected_amount === null ? undefined : Number(row.expected_amount),
      dueDay: row.due_day ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

interface DbMonthlyExpense {
  id: string;
  id_user: string;
  name: string;
  expected_amount: string | null;
  due_day: number | null;
  created_at: Date;
  updated_at: Date;
}

interface DbMonthlyExpenseItem extends DbMonthlyExpense {
  paid_at: Date | null;
}
