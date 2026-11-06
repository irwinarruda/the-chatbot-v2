import type { CashFlowBankAccountStatusResponseDTO } from "~/contracts/http/cash-flow/cash-flow";

export function calculateCashFlowNetBalance(
  accounts: CashFlowBankAccountStatusResponseDTO[],
): number {
  return accounts.reduce((total, account) => total + account.balance, 0);
}

export function summarizeCashFlowMonth(
  transactions: { date: string; transferId?: string; value: number }[],
  month: string,
) {
  let income = 0;
  let spending = 0;
  for (const transaction of transactions) {
    if (transaction.transferId || !transaction.date.startsWith(month)) continue;
    if (transaction.value >= 0) income += transaction.value;
    else spending -= transaction.value;
  }
  return { income, spending };
}
