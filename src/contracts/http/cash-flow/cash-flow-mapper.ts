import type { CashFlowDashboardDTO } from "~/domain/cash-flow/cash-flow-commands";
import { formatCashFlowDate } from "~/domain/cash-flow/cash-flow-date";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";
import {
  type CashFlowDashboardResponseDTO,
  CashFlowDashboardResponseDTO as CashFlowDashboardResponseSchema,
} from "./cash-flow";

export function toCashFlowDashboardResponse(
  dashboard: CashFlowDashboardDTO,
): CashFlowDashboardResponseDTO {
  const lastIndex = dashboard.transactions.length - 1;
  return CashFlowDashboardResponseSchema.parse({
    transactions: dashboard.transactions.map((transaction, index) => ({
      position: index,
      transferId: transaction.transferId,
      paymentId: transaction.paymentId,
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
