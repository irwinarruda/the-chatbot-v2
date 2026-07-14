export interface CashFlowSyncBankAccountBalanceDTO {
  phoneNumber: string;
  bankAccount: string;
  currentBalance: number;
  category: string;
  description: string;
  date: Date;
}

export interface CashFlowAddExpenseDTO {
  phoneNumber: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

export interface CashFlowAddEarningDTO {
  phoneNumber: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

export interface CashFlowTransferDTO {
  phoneNumber: string;
  date: Date;
  value: number;
  description: string;
  from: string;
  to: string;
}
