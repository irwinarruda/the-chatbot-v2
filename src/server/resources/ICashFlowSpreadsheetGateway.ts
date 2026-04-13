export interface Transaction {
  sheetId: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

export interface AddTransactionDTO extends Transaction {
  sheetAccessToken: string;
}

export interface AddExpenseDTO extends AddTransactionDTO {}

export interface AddEarningDTO extends AddTransactionDTO {}

export interface SheetConfigDTO {
  sheetId: string;
  sheetAccessToken: string;
}

export interface ICashFlowSpreadsheetGateway {
  addTransaction(transaction: AddTransactionDTO): Promise<void>;
  addExpense(expense: AddExpenseDTO): Promise<void>;
  addEarning(earning: AddEarningDTO): Promise<void>;
  deleteLastTransaction(sheetConfig: SheetConfigDTO): Promise<void>;
  getSpreadsheetIdByUrl(url: string): string;
  getAllTransactions(sheetConfig: SheetConfigDTO): Promise<Transaction[]>;
  getLastTransaction(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction | undefined>;
  getExpenseCategories(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getEarningCategories(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getBankAccount(sheetConfig: SheetConfigDTO): Promise<string[]>;
}
