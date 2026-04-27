import { google } from "googleapis";
import type { GoogleConfig, GoogleSheetsConfig } from "~/infra/config";
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

export class GoogleCashFlowSpreadsheetGateway
  implements ICashFlowSpreadsheetGateway
{
  constructor(
    private googleConfig: GoogleConfig,
    private googleSheetsConfig: GoogleSheetsConfig,
  ) {}

  async addTransaction(transaction: AddTransactionDTO): Promise<void> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        transaction.sheetId,
        transaction.sheetAccessToken,
      );
      const query = "Diário!A:G";
      const sheet = await sheetsService.spreadsheets.values.get({
        spreadsheetId: transaction.sheetId,
        range: query,
      });
      this.throwWrongSpreadsheetException(sheet.data.values);
      const nextLine = (sheet.data.values?.length ?? 0) + 1;
      const transactionDate = this.formatDate(transaction.date);
      const transactionValue = transaction.value.toString().replace(".", ",");
      await sheetsService.spreadsheets.values.batchUpdate({
        spreadsheetId: transaction.sheetId,
        requestBody: {
          data: [
            { values: [[transactionDate]], range: `Diário!B${nextLine}` },
            {
              values: [
                [
                  transactionValue,
                  transaction.category,
                  transaction.description,
                  transaction.bankAccount,
                ],
              ],
              range: `Diário!D${nextLine}:G${nextLine}`,
            },
          ],
          valueInputOption: "USER_ENTERED",
        },
      });
    });
  }

  async addExpense(expense: AddExpenseDTO): Promise<void> {
    expense.value = Math.abs(expense.value) * -1;
    await this.addTransaction(expense);
  }

  async addEarning(earning: AddEarningDTO): Promise<void> {
    earning.value = Math.abs(earning.value);
    await this.addTransaction(earning);
  }

  async deleteLastTransaction(sheetConfig: SheetConfigDTO): Promise<void> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        sheetConfig.sheetId,
        sheetConfig.sheetAccessToken,
      );
      const query = "Diário!A:G";
      const sheet = await sheetsService.spreadsheets.values.get({
        spreadsheetId: sheetConfig.sheetId,
        range: query,
      });
      this.throwWrongSpreadsheetException(sheet.data.values);
      const lastItemLine = sheet.data.values?.length ?? 0;
      if (lastItemLine <= 2) {
        throw new ValidationException(
          "There are no items to be deleted",
          "Verify if deleting is the correct operation",
        );
      }
      await sheetsService.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetConfig.sheetId,
        requestBody: {
          data: [
            { values: [[""]], range: `Diário!B${lastItemLine}` },
            {
              values: [["", "", "", ""]],
              range: `Diário!D${lastItemLine}:G${lastItemLine}`,
            },
          ],
          valueInputOption: "USER_ENTERED",
        },
      });
    });
  }

  getSpreadsheetIdByUrl(url: string): string {
    if (!url.includes("docs.google.com/spreadsheets")) {
      throw new ValidationException(
        "Invalid url",
        "Please provide a valid Google Sheets URL",
      );
    }
    const split = url.split("/");
    const id = split[5];
    if (!id) {
      throw new ValidationException(
        "Invalid url",
        "Please provide a valid Google Sheets URL",
      );
    }
    return id;
  }

  async getAllTransactions(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction[]> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        sheetConfig.sheetId,
        sheetConfig.sheetAccessToken,
      );
      const query = "Diário!B:G";
      const sheet = await sheetsService.spreadsheets.values.get({
        spreadsheetId: sheetConfig.sheetId,
        range: query,
      });
      this.throwWrongSpreadsheetException(sheet.data.values);
      const values = sheet.data.values ?? [];
      if (values.length <= 2) return [];
      const items = values.slice(2);
      return items
        .filter((row) => Array.isArray(row) && row.length >= 5)
        .map((row) => ({
          sheetId: sheetConfig.sheetId,
          date: this.parseDate(String(row[0] ?? "")),
          value: this.parseDouble(String(row[2] ?? "")),
          category: String(row[3] ?? ""),
          description: String(row[4] ?? ""),
          bankAccount: String(row[5] ?? ""),
        }));
    });
  }

  async getLastTransaction(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction | undefined> {
    const transactions = await this.getAllTransactions(sheetConfig);
    if (transactions.length === 0) return undefined;
    return transactions[transactions.length - 1];
  }

  async getExpenseCategories(sheetConfig: SheetConfigDTO): Promise<string[]> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        sheetConfig.sheetId,
        sheetConfig.sheetAccessToken,
      );
      const result = await sheetsService.spreadsheets.values.batchGet({
        spreadsheetId: sheetConfig.sheetId,
        ranges: [
          "DADOS Gerais + Plano de Contas!D9:D12",
          "DADOS Gerais + Plano de Contas!D15:D26",
          "DADOS Gerais + Plano de Contas!D29:D35",
          "DADOS Gerais + Plano de Contas!D38:D44",
          "DADOS Gerais + Plano de Contas!D47:D58",
          "DADOS Gerais + Plano de Contas!D61:D65",
          "DADOS Gerais + Plano de Contas!D68:D80",
        ],
      });
      this.throwWrongSpreadsheetException(result.data.valueRanges);
      return (result.data.valueRanges ?? [])
        .flatMap((range) => range.values ?? [])
        .flat()
        .map((item) => String(item ?? ""))
        .filter((s) => s.length > 0);
    });
  }

  async getEarningCategories(sheetConfig: SheetConfigDTO): Promise<string[]> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        sheetConfig.sheetId,
        sheetConfig.sheetAccessToken,
      );
      const result = await sheetsService.spreadsheets.values.batchGet({
        spreadsheetId: sheetConfig.sheetId,
        ranges: [
          "DADOS Gerais + Plano de Contas!B9:B14",
          "DADOS Gerais + Plano de Contas!B17:B19",
          "DADOS Gerais + Plano de Contas!B22:B23",
        ],
      });
      this.throwWrongSpreadsheetException(result.data.valueRanges);
      return (result.data.valueRanges ?? [])
        .flatMap((range) => range.values ?? [])
        .flat()
        .map((item) => String(item ?? ""))
        .filter((s) => s.length > 0);
    });
  }

  async getBankAccount(sheetConfig: SheetConfigDTO): Promise<string[]> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        sheetConfig.sheetId,
        sheetConfig.sheetAccessToken,
      );
      const sheet = await sheetsService.spreadsheets.values.get({
        spreadsheetId: sheetConfig.sheetId,
        range: "DADOS Gerais + Plano de Contas!F9:F24",
      });
      this.throwWrongSpreadsheetException(sheet.data.values);
      return (sheet.data.values ?? [])
        .flat()
        .map((item) => String(item ?? ""))
        .filter((s) => s.length > 0);
    });
  }

  async getBankAccountsStatus(
    sheetConfig: SheetConfigDTO,
    date = new Date(),
  ): Promise<BankAccountStatus[]> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        sheetConfig.sheetId,
        sheetConfig.sheetAccessToken,
      );
      const spreadsheet = await sheetsService.spreadsheets.get({
        spreadsheetId: sheetConfig.sheetId,
        fields: "sheets.properties.title",
        includeGridData: false,
      });
      this.throwWrongSpreadsheetException(spreadsheet.data.sheets);
      const candidateTitles = (spreadsheet.data.sheets ?? [])
        .map((sheet) => sheet.properties?.title ?? "")
        .filter((title) => /^Fluxo de Caixa(?: \d{4})?$/.test(title));
      if (candidateTitles.length === 0) {
        throw new ValidationException(
          "There is something wrong with your spreadsheet",
          "The cash flow sheet could not be found",
        );
      }

      const yearRanges = candidateTitles.map(
        (title) => `${this.quoteSheetName(title)}!B4`,
      );
      const yearResult = await sheetsService.spreadsheets.values.batchGet({
        spreadsheetId: sheetConfig.sheetId,
        ranges: yearRanges,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      this.throwWrongSpreadsheetException(yearResult.data.valueRanges);
      const expectedYear = date.getFullYear();
      const sheetTitle = (yearResult.data.valueRanges ?? [])
        .map((range, index) => ({
          title: candidateTitles[index],
          year: this.parseCellNumber(range.values?.[0]?.[0]),
        }))
        .find((item) => item.year === expectedYear)?.title;

      if (!sheetTitle) {
        throw new ValidationException(
          "There is something wrong with your spreadsheet",
          `The cash flow sheet for ${expectedYear} could not be found`,
        );
      }

      const monthColumns = [
        "C",
        "E",
        "G",
        "I",
        "K",
        "M",
        "O",
        "Q",
        "S",
        "U",
        "W",
        "Y",
      ];
      const balanceColumn = monthColumns[date.getMonth()];
      if (!balanceColumn) {
        throw new ValidationException("Invalid date");
      }

      const quotedTitle = this.quoteSheetName(sheetTitle);
      const statusResult = await sheetsService.spreadsheets.values.batchGet({
        spreadsheetId: sheetConfig.sheetId,
        ranges: [
          `${quotedTitle}!B120:B135`,
          `${quotedTitle}!${balanceColumn}120:${balanceColumn}135`,
        ],
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      this.throwWrongSpreadsheetException(statusResult.data.valueRanges);
      const accountRows = statusResult.data.valueRanges?.[0]?.values ?? [];
      const balanceRows = statusResult.data.valueRanges?.[1]?.values ?? [];
      return accountRows
        .map((row, index) => ({
          bankAccount: String(row[0] ?? "").trim(),
          balance: this.parseCellNumber(balanceRows[index]?.[0]),
        }))
        .filter(
          (item) =>
            item.bankAccount.length > 0 &&
            Number.isFinite(item.balance) &&
            item.balance !== 0,
        );
    });
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (ex) {
      if (this.isRateLimitError(ex)) {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return operation();
      }
      throw this.handleError(ex);
    }
  }

  private isRateLimitError(ex: unknown): boolean {
    const cause =
      ex instanceof ServiceException
        ? (ex.cause as Error | undefined)
        : ex instanceof Error
          ? ex
          : null;
    if (!cause) return false;
    const message = cause.message ?? "";
    return (
      message.includes("Quota exceeded") ||
      message.includes("rateLimitExceeded") ||
      message.includes("RESOURCE_EXHAUSTED")
    );
  }

  private getSheetsService(sheetId: string, accessToken: string) {
    if (sheetId === this.googleSheetsConfig.testSheetId) {
      const { JWT } = google.auth;
      const authClient = new JWT({
        email: this.googleConfig.serviceAccountId,
        key: this.googleConfig.serviceAccountPrivateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      return google.sheets({ version: "v4", auth: authClient });
    }
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.sheets({ version: "v4", auth: oauth2Client });
  }

  private throwWrongSpreadsheetException(data: unknown): void {
    if (!data) {
      throw new ValidationException(
        "There is something wrong with your spreadsheet",
        "Either you have the wrong spreadsheet or it's breaking the default patterns",
      );
    }
  }

  private handleError(ex: unknown): Error {
    if (ex instanceof ValidationException || ex instanceof ServiceException)
      return ex;
    return new ServiceException(
      ex instanceof Error ? ex : undefined,
      "Spreadsheet service is not working at the moment.",
    );
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private parseDate(value: string): Date {
    const parts = value.split("/");
    if (parts.length !== 3) return new Date();
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  }

  private parseDouble(value: string): number {
    if (!value?.trim()) return 0;
    value = value.replace("R$ ", "").trim();
    if (!value) return 0;
    if (value.includes(",") && value.includes(".")) {
      if (value.lastIndexOf(",") > value.lastIndexOf(".")) {
        value = value.replace(/\./g, "").replace(",", ".");
      } else {
        value = value.replace(/,/g, "");
      }
    } else if (value.includes(",")) {
      value = value.replace(",", ".");
    }
    return parseFloat(value);
  }

  private parseCellNumber(value: unknown): number {
    if (typeof value === "number") return value;
    return this.parseDouble(String(value ?? ""));
  }

  private quoteSheetName(sheetName: string): string {
    return `'${sheetName.replace(/'/g, "''")}'`;
  }
}
