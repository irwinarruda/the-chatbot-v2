import {
  MonthlyExpenseResponse,
  type MonthlyExpenseResponse as MonthlyExpenseResponseType,
} from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import type { MonthlyExpenseItem } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseServiceDTO";

export function toMonthlyExpenseResponse(
  item: MonthlyExpenseItem,
): MonthlyExpenseResponseType {
  return MonthlyExpenseResponse.parse({
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
