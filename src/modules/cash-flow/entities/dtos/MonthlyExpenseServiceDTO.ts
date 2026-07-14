import type { MonthlyExpense } from "~/modules/cash-flow/entities/MonthlyExpense";

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
