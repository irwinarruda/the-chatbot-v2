import { google } from "googleapis";
import type { GoogleConfig, GoogleSheetsConfig } from "~/infra/config";
import { ServiceException, ValidationException } from "~/infra/exceptions";
import type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  ICashFlowSpreadsheetGateway,
  SheetConfigDTO,
  Transaction,
} from "~/resources/ICashFlowSpreadsheetGateway";

export class GoogleCashFlowSpreadsheetGateway
  implements ICashFlowSpreadsheetGateway
{
  constructor(
    private googleConfig: GoogleConfig,
    private googleSheetsConfig: GoogleSheetsConfig,
  ) {}

  async addTransaction(transaction: AddTransactionDTO): Promise<void> {
    try {
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
    } catch (ex) {
      throw this.handleError(ex);
    }
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
    try {
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
    } catch (ex) {
      throw this.handleError(ex);
    }
  }

  getSpreadsheetIdByUrl(url: string): string {
    try {
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
    } catch (ex) {
      throw this.handleError(ex);
    }
  }

  async getAllTransactions(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction[]> {
    try {
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
        .filter((row) => row != null && row.length >= 5)
        .map((row) => ({
          sheetId: sheetConfig.sheetId,
          date: this.parseDate(String(row[0] ?? "")),
          value: this.parseDouble(String(row[2] ?? "")),
          category: String(row[3] ?? ""),
          description: String(row[4] ?? ""),
          bankAccount: String(row[5] ?? ""),
        }));
    } catch (ex) {
      throw this.handleError(ex);
    }
  }

  async getLastTransaction(
    sheetConfig: SheetConfigDTO,
  ): Promise<Transaction | undefined> {
    const transactions = await this.getAllTransactions(sheetConfig);
    if (transactions.length === 0) return undefined;
    return transactions[transactions.length - 1];
  }

  async getExpenseCategories(sheetConfig: SheetConfigDTO): Promise<string[]> {
    try {
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
    } catch (ex) {
      throw this.handleError(ex);
    }
  }

  async getEarningCategories(sheetConfig: SheetConfigDTO): Promise<string[]> {
    try {
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
    } catch (ex) {
      throw this.handleError(ex);
    }
  }

  async getBankAccount(sheetConfig: SheetConfigDTO): Promise<string[]> {
    try {
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
    } catch (ex) {
      throw this.handleError(ex);
    }
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
    if (data == null) {
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
}
