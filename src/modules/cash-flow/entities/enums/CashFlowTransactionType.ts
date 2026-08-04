export const CashFlowTransactionType = {
  Expense: "Expense",
  Earning: "Earning",
} as const;

export type CashFlowTransactionType = ValueOf<typeof CashFlowTransactionType>;
