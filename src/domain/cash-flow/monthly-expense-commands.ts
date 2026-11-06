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
  defaultBankAccount?: string;
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
  defaultBankAccount?: string;
  clearDefaultBankAccount?: boolean;
  month?: string;
}

export interface SaveMonthlyExpensePaymentDetailsDTO {
  idUser: string;
  id: string;
  month: string;
  category?: string;
  defaultBankAccount?: string;
}
