export interface AddTransactionDTO extends Transaction {
  sheetAccessToken: string;
}

export type AddExpenseDTO = AddTransactionDTO;

export type AddEarningDTO = AddTransactionDTO;

export interface SheetConfigDTO {
  sheetId: string;
  sheetAccessToken: string;
}

export interface Transaction {
  sheetId: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

export interface BankAccountStatus {
  bankAccount: string;
  balance: number;
}
