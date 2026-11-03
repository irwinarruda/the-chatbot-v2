import type {
  CreateMonthlyExpenseRequestDTO,
  MonthlyExpenseResponseDTO,
  MonthlyExpensesResponseDTO,
  PayMonthlyExpenseRequestDTO,
  SetMonthlyExpensePaidRequestDTO,
  UpdateMonthlyExpenseRequestDTO,
} from "~/contracts/http/cash-flow/monthly-expense";

export interface MonthlyExpenseRepository {
  list(month?: string): Promise<MonthlyExpensesResponseDTO>;
  create(
    dto: CreateMonthlyExpenseRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
  update(
    id: string,
    dto: UpdateMonthlyExpenseRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
  archive(id: string): Promise<void>;
  payFromAccount(
    id: string,
    dto: PayMonthlyExpenseRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
  setPaid(
    id: string,
    dto: SetMonthlyExpensePaidRequestDTO,
  ): Promise<MonthlyExpenseResponseDTO>;
}
