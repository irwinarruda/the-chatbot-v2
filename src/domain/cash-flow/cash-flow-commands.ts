import type {
  BankAccountStatusDTO,
  TransactionDTO,
} from "./cash-flow-transaction";
import type { CashFlowTransactionType } from "./cash-flow-transaction-type";

export interface CashFlowDashboardDTO {
  transactions: TransactionDTO[];
  bankAccounts: string[];
  expenseCategories: string[];
  earningCategories: string[];
  bankAccountStatuses: BankAccountStatusDTO[];
}

export interface CashFlowAddTransactionDTO {
  phoneNumber: string;
  type: CashFlowTransactionType;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

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
  id?: string;
  phoneNumber: string;
  date: Date;
  value: number;
  description: string;
  from: string;
  to: string;
}
