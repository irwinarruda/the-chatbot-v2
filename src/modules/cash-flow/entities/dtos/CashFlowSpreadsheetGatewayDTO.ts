export interface AddTransactionDTO extends TransactionDTO {
  sheetAccessToken: string;
}

export type AddExpenseDTO = AddTransactionDTO;

export type AddEarningDTO = AddTransactionDTO;

export interface SheetConfigDTO {
  sheetId: string;
  sheetAccessToken: string;
}

export interface TransactionDTO {
  sheetId: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

export interface BankAccountStatusDTO {
  bankAccount: string;
  balance: number;
}
