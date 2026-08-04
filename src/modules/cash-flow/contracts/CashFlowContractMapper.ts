import type { CashFlowDashboardDTO } from "~/modules/cash-flow/entities/dtos/CashFlowServiceDTO";
import {
  type CashFlowDashboardResponseDTO,
  CashFlowDashboardResponseDTO as CashFlowDashboardResponseSchema,
} from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";
import { formatCashFlowDate } from "~/modules/cash-flow/utils/CashFlowDate";

export function toCashFlowDashboardResponse(
  dashboard: CashFlowDashboardDTO,
): CashFlowDashboardResponseDTO {
  const lastIndex = dashboard.transactions.length - 1;
  return CashFlowDashboardResponseSchema.parse({
    transactions: dashboard.transactions.map((transaction, index) => ({
      position: index,
      date: formatCashFlowDate(transaction.date),
      value: transaction.value,
      type:
        transaction.value < 0
          ? CashFlowTransactionType.Expense
          : CashFlowTransactionType.Earning,
      category: transaction.category,
      description: transaction.description,
      bankAccount: transaction.bankAccount,
      isLast: index === lastIndex,
    })),
    bankAccounts: dashboard.bankAccounts,
    expenseCategories: dashboard.expenseCategories,
    earningCategories: dashboard.earningCategories,
    bankAccountStatuses: dashboard.bankAccountStatuses,
  });
}
