import type { MonthlyExpense } from "./monthly-expense";

export interface MonthlyExpenseItemDTO {
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
  category?: string;
  bankAccount?: string;
  month?: string;
}

export interface UpdateMonthlyExpenseDTO {
  idUser: string;
  id: string;
  name?: string;
  expectedAmount?: number;
  clearExpectedAmount?: boolean;
  dueDay?: number;
  clearDueDay?: boolean;
  category?: string;
  clearCategory?: boolean;
  bankAccount?: string;
  clearBankAccount?: boolean;
  month?: string;
}
