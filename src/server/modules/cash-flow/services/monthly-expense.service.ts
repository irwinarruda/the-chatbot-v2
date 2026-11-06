import { MonthlyExpense } from "~/domain/cash-flow/monthly-expense";
import type {
  CreateMonthlyExpenseDTO,
  MonthlyExpenseItemDTO,
  SaveMonthlyExpensePaymentDetailsDTO,
  UpdateMonthlyExpenseDTO,
} from "~/domain/cash-flow/monthly-expense-commands";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { MonthlyExpenseRepository } from "~/server/modules/cash-flow/repositories/monthly-expense.repository";
import { NotFoundException } from "~/server/shared/errors/application-errors";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

export class MonthlyExpenseService {
  constructor(
    private expenses: MonthlyExpenseRepository,
    private now: () => Date = () => new Date(),
  ) {}

  currentMonth(): string {
    return monthFormatter.format(this.now()).slice(0, 7);
  }

  async listMonthlyExpenses(
    idUser: string,
    month = this.currentMonth(),
  ): Promise<MonthlyExpenseItemDTO[]> {
    this.validateMonth(month);
    return this.expenses.list(idUser, month);
  }

  async createMonthlyExpense(
    dto: CreateMonthlyExpenseDTO,
  ): Promise<MonthlyExpenseItemDTO> {
    const expense = new MonthlyExpense(dto);
    const month = dto.month ?? this.currentMonth();
    this.validateMonth(month);
    await this.expenses.create(expense, month);
    return this.getMonthlyExpense(dto.idUser, expense.id, month);
  }

  async updateMonthlyExpense(
    dto: UpdateMonthlyExpenseDTO,
  ): Promise<MonthlyExpenseItemDTO> {
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
    if (dto.clearCategory) {
      expense.changeCategory(undefined);
    } else if (dto.category !== undefined) {
      expense.changeCategory(dto.category);
    }
    if (dto.clearDefaultBankAccount) {
      expense.changeDefaultBankAccount(undefined);
    } else if (dto.defaultBankAccount !== undefined) {
      expense.changeDefaultBankAccount(dto.defaultBankAccount);
    }
    expense.updatedAt = this.now();
    await this.expenses.saveVersion(expense, month);
    return this.getMonthlyExpense(dto.idUser, dto.id, month);
  }

  async saveMonthlyExpensePaymentDetails(
    dto: SaveMonthlyExpensePaymentDetailsDTO,
  ): Promise<void> {
    const { expense } = await this.getMonthlyExpense(
      dto.idUser,
      dto.id,
      dto.month,
    );
    if (dto.category !== undefined) expense.changeCategory(dto.category);
    if (dto.defaultBankAccount !== undefined) {
      expense.changeDefaultBankAccount(dto.defaultBankAccount);
    }
    expense.updatedAt = this.now();
    await this.expenses.savePaymentDetails(expense, dto.month);
  }

  async archiveMonthlyExpense(idUser: string, id: string): Promise<void> {
    const isArchived = await this.expenses.archive(idUser, id, this.now());
    if (!isArchived) {
      throw new NotFoundException("Monthly expense not found");
    }
  }

  async setMonthlyExpensePaid(
    idUser: string,
    id: string,
    isPaid: boolean,
    month = this.currentMonth(),
    paidAt?: Date,
  ): Promise<MonthlyExpenseItemDTO> {
    this.validateMonth(month);
    await this.getMonthlyExpense(idUser, id, month);
    if (isPaid) {
      await this.expenses.markPaid(id, month, paidAt, this.now());
    } else {
      await this.expenses.unmarkPaid(id, month);
    }
    return this.getMonthlyExpense(idUser, id, month);
  }

  private async getMonthlyExpense(
    idUser: string,
    id: string,
    month = this.currentMonth(),
  ): Promise<MonthlyExpenseItemDTO> {
    this.validateMonth(month);
    const item = await this.expenses.get(idUser, id, month);
    if (!item) throw new NotFoundException("Monthly expense not found");
    return item;
  }

  private validateMonth(month: string): void {
    if (!MONTH_PATTERN.test(month)) {
      throw new ValidationException("Monthly expense month is invalid");
    }
  }
}
