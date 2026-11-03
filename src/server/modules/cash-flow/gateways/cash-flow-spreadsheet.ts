import type { SaveSpreadsheetTransferDTO } from "~/contracts/http/cash-flow/cash-flow-transfer";
import type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  BankAccountStatusDTO,
  SheetConfigDTO,
  TransactionDTO,
} from "~/domain/cash-flow/cash-flow-transaction";

export type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  BankAccountStatusDTO,
  SheetConfigDTO,
  TransactionDTO,
} from "~/domain/cash-flow/cash-flow-transaction";

export interface CashFlowSpreadsheetGateway {
  saveTransfer(
    dto: SaveSpreadsheetTransferDTO,
    replace: boolean,
  ): Promise<void>;
  deleteTransfer(config: SheetConfigDTO, id: string): Promise<void>;
  addBillPayment(
    dto: AddExpenseDTO & { paymentId: string },
  ): Promise<TransactionDTO>;

  addTransaction(transaction: AddTransactionDTO): Promise<void>;
  addExpense(expense: AddExpenseDTO): Promise<void>;
  addEarning(earning: AddEarningDTO): Promise<void>;
  deleteLastTransaction(sheetConfig: SheetConfigDTO): Promise<void>;
  getSpreadsheetIdByUrl(url: string): string;
  getAllTransactions(sheetConfig: SheetConfigDTO): Promise<TransactionDTO[]>;
  getLatestTransactions(
    sheetConfig: SheetConfigDTO,
    limit: number,
  ): Promise<TransactionDTO[]>;
  getLastTransaction(
    sheetConfig: SheetConfigDTO,
  ): Promise<TransactionDTO | undefined>;
  getExpenseCategories(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getEarningCategories(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getTransferCategory(sheetConfig: SheetConfigDTO): Promise<string>;
  getBankAccount(sheetConfig: SheetConfigDTO): Promise<string[]>;
  getBankAccountsStatus(
    sheetConfig: SheetConfigDTO,
    date?: Date,
  ): Promise<BankAccountStatusDTO[]>;
}
