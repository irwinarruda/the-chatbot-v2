import type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  BankAccountStatus,
  SheetConfigDTO,
  Transaction,
} from "~/modules/cash-flow/entities/dtos/CashFlowSpreadsheetGatewayDTO";

export type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  BankAccountStatus,
  SheetConfigDTO,
  Transaction,
} from "~/modules/cash-flow/entities/dtos/CashFlowSpreadsheetGatewayDTO";

export interface CashFlowSpreadsheetGateway {
  addTransaction(transaction: AddTransactionDTO): Promise<void>;
  addExpense(expense: AddExpenseDTO): Promise<void>;
  addEarning(earning: AddEarningDTO): Promise<void>;
  deleteLastTransaction(sheetConfig: SheetConfigDTO): Promise<void>;
  getSpreadsheetIdByUrl(url: string): string;
  getAllTransactions(sheetConfig: SheetConfigDTO): Promise<Transaction[]>;
  getLatestTransactions(
    sheetConfig: SheetConfigDTO,
    limit: number,
  ): Promise<Transaction[]>;
  getLastTransaction(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction | undefined>;
  getExpenseCategories(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getEarningCategories(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getTransferCategory(sheetConfig: SheetConfigDTO): Promise<string>;
  getBankAccount(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getBankAccountsStatus(
    sheetConfig: SheetConfigDTO,
    date?: Date,
  ): Promise<BankAccountStatus[]>;
}
