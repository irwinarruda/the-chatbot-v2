import type { MonthlyExpenseItemDTO } from "~/domain/cash-flow/monthly-expense-commands";
import {
  MonthlyExpenseResponseDTO,
  type MonthlyExpenseResponseDTO as MonthlyExpenseResponseType,
} from "./monthly-expense";

export function toMonthlyExpenseResponse(
  item: MonthlyExpenseItemDTO,
): MonthlyExpenseResponseType {
  return MonthlyExpenseResponseDTO.parse({
    id: item.expense.id,
    name: item.expense.name,
    expectedAmount: item.expense.expectedAmount,
    dueDay: item.expense.dueDay,
    month: item.month,
    isPaid: item.isPaid,
    paidAt: item.paidAt?.toISOString(),
    createdAt: item.expense.createdAt.toISOString(),
    updatedAt: item.expense.updatedAt.toISOString(),
  });
}
