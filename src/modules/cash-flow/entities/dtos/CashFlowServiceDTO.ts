import type {
  BankAccountStatusDTO,
  TransactionDTO,
} from "~/modules/cash-flow/entities/dtos/CashFlowSpreadsheetGatewayDTO";
import type { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";

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
  phoneNumber: string;
  date: Date;
  value: number;
  description: string;
  from: string;
  to: string;
}
