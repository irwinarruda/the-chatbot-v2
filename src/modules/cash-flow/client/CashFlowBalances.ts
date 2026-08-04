import type { CashFlowBankAccountStatusResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";

export function calculateCashFlowNetBalance(
  accounts: CashFlowBankAccountStatusResponseDTO[],
): number {
  return accounts.reduce((total, account) => total + account.balance, 0);
}
