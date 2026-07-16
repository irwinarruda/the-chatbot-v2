import type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  BankAccountStatusDTO,
  CashFlowSpreadsheetGateway,
  SheetConfigDTO,
  TransactionDTO,
} from "~/modules/cash-flow/gateway/CashFlowSpreadsheetGateway";
import type { GoogleSheetsConfig } from "~/shared/config/Config";
import { ServiceException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";

export class TestCashFlowSpreadsheetGateway
  implements CashFlowSpreadsheetGateway
{
  private static transactions: TransactionDTO[] = [];
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
  ): Promise<TransactionDTO[]> {
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

  async getLatestTransactions(
    sheetConfig: SheetConfigDTO,
    limit: number,
  ): Promise<TransactionDTO[]> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    const transactions = TestCashFlowSpreadsheetGateway.transactions;
    const safeLimit = Math.max(0, Math.floor(limit));
    if (safeLimit === 0 || transactions.length === 0) return [];
    return transactions.slice(Math.max(0, transactions.length - safeLimit));
  }

  async getLastTransaction(
    sheetConfig: SheetConfigDTO,
  ): Promise<TransactionDTO | undefined> {
    const [last] = await this.getLatestTransactions(sheetConfig, 1);
    return last;
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

  async getTransferCategory(sheetConfig: SheetConfigDTO): Promise<string> {
    TestCashFlowSpreadsheetGateway.validateAccessToken(
      sheetConfig.sheetAccessToken,
    );
    if (sheetConfig.sheetId !== this.validSheetId) {
      throw new ServiceException(
        undefined,
        "The provided sheet ID is not valid",
      );
    }
    return "Transferência de contas";
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
  ): Promise<BankAccountStatusDTO[]> {
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
        transaction.date.getMonth() > date.getMonth()
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
