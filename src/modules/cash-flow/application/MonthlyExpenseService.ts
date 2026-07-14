import { MonthlyExpense } from "~/modules/cash-flow/domain/MonthlyExpense";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { DatabaseExecutor } from "~/shared/server/DatabaseExecutor";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

export interface MonthlyExpenseItem {
  expense: MonthlyExpense;
  month: string;
  isPaid: boolean;
  paidAt?: Date;
}

export interface CreateMonthlyExpenseDTO {
  idUser: string;
  name: string;
  expectedAmount?: number;
  dueDay?: number;
}

export interface UpdateMonthlyExpenseDTO {
  idUser: string;
  id: string;
  name?: string;
  expectedAmount?: number;
  clearExpectedAmount?: boolean;
  dueDay?: number;
  clearDueDay?: boolean;
}

export class MonthlyExpenseService {
  constructor(
    private database: DatabaseExecutor,
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
    const rows = await this.database.sql<DbMonthlyExpenseItem[]>`
      SELECT
        e.id,
        e.id_user,
        e.name,
        e.expected_amount,
        e.due_day,
        e.created_at,
        e.updated_at,
        p.paid_at
      FROM monthly_expenses e
      LEFT JOIN monthly_expense_payments p
        ON p.id_monthly_expense = e.id
        AND p.month = ${`${month}-01`}::date
      WHERE e.id_user = ${idUser}
      AND e.archived_at IS NULL
      ORDER BY
        CASE WHEN p.paid_at IS NULL THEN 0 ELSE 1 END,
        CASE WHEN e.due_day IS NULL THEN 1 ELSE 0 END,
        e.due_day ASC,
        e.name ASC
    `;
    return rows.map((row) => this.mapItem(row, month));
  }

  async createMonthlyExpense(
    dto: CreateMonthlyExpenseDTO,
  ): Promise<MonthlyExpenseItem> {
    const expense = new MonthlyExpense(dto);
    await this.database.sql`
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
    return this.getMonthlyExpense(dto.idUser, expense.id);
  }

  async updateMonthlyExpense(
    dto: UpdateMonthlyExpenseDTO,
  ): Promise<MonthlyExpenseItem> {
    const expense = await this.getActiveExpense(dto.idUser, dto.id);
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
    await this.database.sql`
      UPDATE monthly_expenses SET
        name = ${expense.name},
        expected_amount = ${expense.expectedAmount ?? null},
        due_day = ${expense.dueDay ?? null},
        updated_at = ${expense.updatedAt}
      WHERE id = ${expense.id}
      AND id_user = ${expense.idUser}
      AND archived_at IS NULL
    `;
    return this.getMonthlyExpense(dto.idUser, dto.id);
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
    await this.getActiveExpense(idUser, id);
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
    const rows = await this.database.sql<DbMonthlyExpenseItem[]>`
      SELECT
        e.id,
        e.id_user,
        e.name,
        e.expected_amount,
        e.due_day,
        e.created_at,
        e.updated_at,
        p.paid_at
      FROM monthly_expenses e
      LEFT JOIN monthly_expense_payments p
        ON p.id_monthly_expense = e.id
        AND p.month = ${`${month}-01`}::date
      WHERE e.id = ${id}
      AND e.id_user = ${idUser}
      AND e.archived_at IS NULL
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException("Monthly expense not found");
    return this.mapItem(row, month);
  }

  private async getActiveExpense(
    idUser: string,
    id: string,
  ): Promise<MonthlyExpense> {
    const rows = await this.database.sql<DbMonthlyExpense[]>`
      SELECT
        id,
        id_user,
        name,
        expected_amount,
        due_day,
        created_at,
        updated_at
      FROM monthly_expenses
      WHERE id = ${id}
      AND id_user = ${idUser}
      AND archived_at IS NULL
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException("Monthly expense not found");
    return this.mapExpense(row);
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
