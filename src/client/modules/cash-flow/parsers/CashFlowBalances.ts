import type { CashFlowBankAccountStatusResponseDTO } from "~/contracts/http/cash-flow/cash-flow";

export function calculateCashFlowNetBalance(
  accounts: CashFlowBankAccountStatusResponseDTO[],
): number {
  return accounts.reduce((total, account) => total + account.balance, 0);
}
