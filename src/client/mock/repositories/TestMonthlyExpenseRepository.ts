import { DemoMonth, DemoNow, mockDb } from "~/client/mock/db";
import type { MonthlyExpenseRepository } from "~/client/modules/cash-flow/app/repositories/MonthlyExpenseRepository";
import type {
  CreateMonthlyExpenseRequestDTO,
  MonthlyExpenseResponseDTO,
  PayMonthlyExpenseRequestDTO,
  SetMonthlyExpensePaidRequestDTO,
  UpdateMonthlyExpenseRequestDTO,
} from "~/contracts/http/cash-flow/monthly-expense";
import { NotFoundError } from "./NotFoundError";

export class TestMonthlyExpenseRepository implements MonthlyExpenseRepository {
  async list(month = DemoMonth) {
    return {
      month,
      expenses: mockDb.monthlyExpenses.map((expense) => ({
        ...expense,
        month,
      })),
    };
  }

  async create(dto: CreateMonthlyExpenseRequestDTO) {
    const expense: MonthlyExpenseResponseDTO = {
      id: crypto.randomUUID(),
      name: dto.name,
      expectedAmount: dto.expectedAmount,
      dueDay: dto.dueDay,
      category: dto.category,
      bankAccount: dto.bankAccount,
      month: dto.month ?? DemoMonth,
      isPaid: false,
      createdAt: DemoNow,
      updatedAt: DemoNow,
    };
    mockDb.monthlyExpenses.push(expense);
    return expense;
  }

  async update(id: string, dto: UpdateMonthlyExpenseRequestDTO) {
    const expense = findExpense(id);
    if (dto.name !== undefined) expense.name = dto.name;
    if (dto.expectedAmount !== undefined) {
      expense.expectedAmount = dto.expectedAmount ?? undefined;
    }
    if (dto.dueDay !== undefined) expense.dueDay = dto.dueDay ?? undefined;
    if (dto.category !== undefined) {
      expense.category = dto.category ?? undefined;
    }
    if (dto.bankAccount !== undefined) {
      expense.bankAccount = dto.bankAccount ?? undefined;
    }
    expense.updatedAt = DemoNow;
    return expense;
  }

  async archive(id: string) {
    mockDb.monthlyExpenses = mockDb.monthlyExpenses.filter(
      (expense) => expense.id !== id,
    );
  }

  async payFromAccount(id: string, dto: PayMonthlyExpenseRequestDTO) {
    const expense = findExpense(id);
    expense.category = dto.category;
    expense.bankAccount ??= dto.bankAccount;
    return this.setPaid(id, { isPaid: true });
  }

  async setPaid(id: string, dto: SetMonthlyExpensePaidRequestDTO) {
    const expense = findExpense(id);
    expense.isPaid = dto.isPaid;
    expense.paidAt = dto.isPaid ? DemoNow : undefined;
    expense.updatedAt = DemoNow;
    return expense;
  }
}

function findExpense(id: string): MonthlyExpenseResponseDTO {
  const expense = mockDb.monthlyExpenses.find((item) => item.id === id);
  if (!expense) throw new NotFoundError("Monthly expense not found");
  return expense;
}
