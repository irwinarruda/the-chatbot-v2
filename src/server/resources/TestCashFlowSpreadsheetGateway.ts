import type { GoogleSheetsConfig } from "~/infra/config";
import { ServiceException, ValidationException } from "~/infra/exceptions";
import type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  BankAccountStatus,
  ICashFlowSpreadsheetGateway,
  SheetConfigDTO,
  Transaction,
} from "~/server/resources/ICashFlowSpreadsheetGateway";

export class TestCashFlowSpreadsheetGateway
  implements ICashFlowSpreadsheetGateway
{
  private static transactions: Transaction[] = [];
  validSheetId: string;

  constructor(googleSheetsConfig: GoogleSheetsConfig) {
    this.validSheetId = googleSheetsConfig.testSheetId;
  }

  private static validateAccessToken(accessToken: string | undefined) {
    if (accessToken !== "ya29.a0ARrdaM9test_access_token_123456789") {
      throw new ValidationException("Invalid access token");
    }
  }

  async addTransaction(transaction: AddTransactionDTO): Promise<void> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      transaction.sheetAccessToken,
    );
    if (transaction.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    TestCashFlowSpreadsheetGateway.transactions.push({
      sheetId: transaction.sheetId,
      date: new Date(transaction.date.toDateString()),
      value: transaction.value,
      category: transaction.category,
      description: transaction.description,
      bankAccount: transaction.bankAccount,
    });
  }

  async addExpense(expense: AddExpenseDTO): Promise<void> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      expense.sheetAccessToken,
    );
    expense.value = Math.abs(expense.value) * -1;
    await this.addTransaction(expense);
  }

  async addEarning(earning: AddEarningDTO): Promise<void> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      earning.sheetAccessToken,
    );
    earning.value = Math.abs(earning.value);
    await this.addTransaction(earning);
  }

  async deleteLastTransaction(sheetConfig: SheetConfigDTO): Promise<void> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    if (TestCashFlowSpreadsheetGateway.transactions.length === 0) {
      throw new ValidationException(
        "There are no items to be deleted",
        "Verify if deleting is the correct operation",
      );
    }
    TestCashFlowSpreadsheetGateway.transactions.pop();
  }

  async getAllTransactions(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction[]> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    return TestCashFlowSpreadsheetGateway.transactions;
  }

  async getLastTransaction(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction | undefined> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    if (TestCashFlowSpreadsheetGateway.transactions.length === 0)
      return undefined;
    return TestCashFlowSpreadsheetGateway.transactions.at(-1);
  }

  async getExpenseCategories(sheetConfig: SheetConfigDTO): Promise<string[]> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    return ["Telefone, internet e TV", "Delivery"];
  }

  async getEarningCategories(sheetConfig: SheetConfigDTO): Promise<string[]> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    return ["Salário", "Outras Receitas"];
  }

  async getBankAccount(sheetConfig: SheetConfigDTO): Promise<string[]> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    return ["NuConta", "Caju"];
  }

  async getBankAccountsStatus(
    sheetConfig: SheetConfigDTO,
    date = new Date(),
  ): Promise<BankAccountStatus[]> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    const balances = new Map<string, number>();
    for (const transaction of TestCashFlowSpreadsheetGateway.transactions) {
      if (
        transaction.date.getFullYear() !== date.getFullYear() ||
        transaction.date.getMonth() !== date.getMonth()
      ) {
        continue;
      }
      balances.set(
        transaction.bankAccount,
        (balances.get(transaction.bankAccount) ?? 0) + transaction.value,
      );
    }
    const accountOrder = [
      "Dinheiro",
      "Banco do Brasil",
      "Itaú",
      "Bradesco",
      "Santander",
      "Banco Inter",
      "NuConta",
      "Corretora 1",
      "Corretora 2",
      "Corretora 3",
      "Cartão de Crédito - NuBank",
      "Cartão de Crédito - Banco do Brasil",
      "Cartão de Crédito - Inter",
      "Cartão de Crédito - Bradesco",
      "Caixinha Nubank",
      "Caju",
    ];
    const orderedAccounts = [
      ...accountOrder,
      ...[...balances.keys()].filter(
        (account) => !accountOrder.includes(account),
      ),
    ];
    return orderedAccounts
      .map((bankAccount) => ({
        bankAccount,
        balance: balances.get(bankAccount) ?? 0,
      }))
      .filter((item) => item.balance !== 0);
  }

  getSpreadsheetIdByUrl(url: string): string {
    if (!url.includes("docs.google.com/spreadsheets")) {
      throw new ValidationException(
        "Invalid url",
        "Please provide a valid Google Sheets URL",
      );
    }
    const parts = url.split("/");
    const id = parts[5];
    if (!id) {
      throw new ValidationException(
        "Invalid url",
        "Please provide a valid Google Sheets URL",
      );
    }
    return id;
  }
}
