import { google, type sheets_v4 } from "googleapis";
import type { SaveSpreadsheetTransferDTO } from "~/modules/cash-flow/entities/dtos/CashFlowTransferDTO";
import type {
  AddEarningDTO,
  AddExpenseDTO,
  AddTransactionDTO,
  BankAccountStatusDTO,
  CashFlowSpreadsheetGateway,
  SheetConfigDTO,
  TransactionDTO,
} from "~/modules/cash-flow/gateway/CashFlowSpreadsheetGateway";
import {
  formatCashFlowDate,
  formatCashFlowSpreadsheetDate,
  getCashFlowMonth,
  parseCashFlowSpreadsheetDate,
} from "~/modules/cash-flow/utils/CashFlowDate";
import type { GoogleConfig, GoogleSheetsConfig } from "~/shared/config/Config";
import { ServiceException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";

export class GoogleCashFlowSpreadsheetGateway
  implements CashFlowSpreadsheetGateway
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
  ): Promise<TransactionDTO[]> {
    const journal = await this.readJournal(sheetConfig);
    return journal.transactions.map(
      ({ rowIndex, ...transaction }) => transaction,
    );
  }

  async saveTransfer(
    dto: SaveSpreadsheetTransferDTO,
    replace: boolean,
  ): Promise<void> {
    const journal = await this.readJournal(dto);
    const existing = journal.transactions.filter(
      (item) => item.transferId === dto.id,
    );
    if ((replace || existing.length > 0) && existing.length !== 2) {
      throw new ValidationException("The linked transfer could not be found");
    }
    if (!replace && existing.length > 0) return;
    const common = {
      sheetId: dto.sheetId,
      date: dto.date,
      category: dto.category,
      description: dto.description,
      transferId: dto.id,
    };
    await this.writeJournal(dto, journal.sheetId, journal.rowCount, [
      {
        ...common,
        value: -dto.value,
        bankAccount: dto.from,
        rowIndex: existing[0]?.rowIndex ?? journal.nextRow,
      },
      {
        ...common,
        value: dto.value,
        bankAccount: dto.to,
        rowIndex: existing[1]?.rowIndex ?? journal.nextRow + 1,
      },
    ]);
  }

  async deleteTransfer(config: SheetConfigDTO, id: string): Promise<void> {
    const journal = await this.readJournal(config);
    const entries = journal.transactions.filter(
      (item) => item.transferId === id,
    );
    if (entries.length === 0) return;
    if (entries.length !== 2)
      throw new ValidationException("The transfer is missing a linked entry");
    const requests: sheets_v4.Schema$Request[] = entries.flatMap(
      ({ rowIndex }) => [
        {
          updateCells: {
            range: {
              sheetId: journal.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 1,
              endColumnIndex: 2,
            },
            fields: "userEnteredValue,note",
          },
        },
        {
          updateCells: {
            range: {
              sheetId: journal.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 3,
              endColumnIndex: 7,
            },
            fields: "userEnteredValue",
          },
        },
      ],
    );
    await this.getSheetsService(
      config.sheetId,
      config.sheetAccessToken,
    ).spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: { requests },
    });
  }

  async addBillPayment(
    dto: AddExpenseDTO & { paymentId: string },
  ): Promise<TransactionDTO> {
    const journal = await this.readJournal(dto);
    const existing = journal.transactions.find(
      (item) => item.paymentId === dto.paymentId,
    );
    if (existing) return existing;
    const transaction = {
      sheetId: dto.sheetId,
      date: dto.date,
      value: -Math.abs(dto.value),
      category: dto.category,
      description: dto.description,
      bankAccount: dto.bankAccount,
      paymentId: dto.paymentId,
    };
    await this.writeJournal(dto, journal.sheetId, journal.rowCount, [
      { ...transaction, rowIndex: journal.nextRow },
    ]);
    return transaction;
  }

  private async readJournal(config: SheetConfigDTO) {
    const result = await this.getSheetsService(
      config.sheetId,
      config.sheetAccessToken,
    ).spreadsheets.get({
      spreadsheetId: config.sheetId,
      ranges: ["Diário!B:G"],
      fields:
        "sheets(properties(sheetId,gridProperties(rowCount)),data(startRow,rowData(values(formattedValue,note))))",
    });
    const sheet = result.data.sheets?.[0];
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null)
      throw new ValidationException("Journal sheet not found");
    const rowCount = sheet?.properties?.gridProperties?.rowCount;
    if (rowCount === undefined || rowCount === null)
      throw new ValidationException("Journal grid not found");
    const rows = sheet?.data?.[0]?.rowData ?? [];
    const transactions = rows.flatMap((row, rowIndex) => {
      const cells = row.values ?? [];
      if (
        rowIndex < 2 ||
        !cells[0]?.formattedValue ||
        !cells[2]?.formattedValue
      )
        return [];
      const note = cells[0]?.note ?? "";
      let transferId: string | undefined;
      let paymentId: string | undefined;
      if (note.startsWith("the-chatbot:transfer:"))
        transferId = note.slice("the-chatbot:transfer:".length);
      if (note.startsWith("the-chatbot:bill:"))
        paymentId = note.slice("the-chatbot:bill:".length);
      return [
        {
          sheetId: config.sheetId,
          rowIndex,
          transferId,
          paymentId,
          date: this.parseDate(cells[0].formattedValue),
          value: this.parseDouble(cells[2].formattedValue),
          category: cells[3]?.formattedValue ?? "",
          description: cells[4]?.formattedValue ?? "",
          bankAccount: cells[5]?.formattedValue ?? "",
        },
      ];
    });
    let nextRow = 2;
    rows.forEach((row, index) => {
      const cells = row.values ?? [];
      if (
        index >= 2 &&
        [0, 2, 3, 4, 5].some(
          (column) => cells[column]?.formattedValue || cells[column]?.note,
        )
      ) {
        nextRow = index + 1;
      }
    });
    return { sheetId, rowCount, transactions, nextRow };
  }

  private async writeJournal(
    config: SheetConfigDTO,
    sheetId: number,
    rowCount: number,
    transactions: (TransactionDTO & { rowIndex: number })[],
  ) {
    const requests: sheets_v4.Schema$Request[] = transactions.flatMap(
      (item) => {
        let note = "";
        if (item.transferId) note = `the-chatbot:transfer:${item.transferId}`;
        if (item.paymentId) note = `the-chatbot:bill:${item.paymentId}`;
        const date = new Date(`${formatCashFlowDate(item.date)}T00:00:00Z`);
        const serialDate = date.getTime() / 86400000 + 25569;
        return [
          {
            updateCells: {
              start: { sheetId, rowIndex: item.rowIndex, columnIndex: 1 },
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { numberValue: serialDate },
                      note,
                      userEnteredFormat: {
                        numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" },
                      },
                    },
                  ],
                },
              ],
              fields: "userEnteredValue,note,userEnteredFormat.numberFormat",
            },
          },
          {
            updateCells: {
              start: { sheetId, rowIndex: item.rowIndex, columnIndex: 3 },
              rows: [
                {
                  values: [
                    { userEnteredValue: { numberValue: item.value } },
                    ...[item.category, item.description, item.bankAccount].map(
                      (stringValue) => ({ userEnteredValue: { stringValue } }),
                    ),
                  ],
                },
              ],
              fields: "userEnteredValue",
            },
          },
        ];
      },
    );
    const requiredRows = Math.max(
      rowCount,
      ...transactions.map((item) => item.rowIndex + 1),
    );
    if (requiredRows > rowCount) {
      requests.unshift({
        appendDimension: {
          sheetId,
          dimension: "ROWS",
          length: requiredRows - rowCount,
        },
      });
    }
    await this.getSheetsService(
      config.sheetId,
      config.sheetAccessToken,
    ).spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: { requests },
    });
  }

  async getLatestTransactions(
    sheetConfig: SheetConfigDTO,
    limit: number,
  ): Promise<TransactionDTO[]> {
    const transactions = await this.getAllTransactions(sheetConfig);
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

  async getTransferCategory(sheetConfig: SheetConfigDTO): Promise<string> {
    return this.withRetry(async () => {
      const sheetsService = this.getSheetsService(
        sheetConfig.sheetId,
        sheetConfig.sheetAccessToken,
      );
      const sheet = await sheetsService.spreadsheets.values.get({
        spreadsheetId: sheetConfig.sheetId,
        range: "DADOS Gerais + Plano de Contas!B17",
      });
      const category = String(sheet.data.values?.[0]?.[0] ?? "");
      if (!category.trim()) {
        throw new ValidationException(
          "Transfer category is not configured in the spreadsheet",
          "Set the transfer category in 'DADOS Gerais + Plano de Contas' cell B17.",
        );
      }
      return category;
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
  ): Promise<BankAccountStatusDTO[]> {
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
      const { year: expectedYear, monthIndex } = getCashFlowMonth(date);
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
      const balanceColumn = monthColumns[monthIndex];
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
    return formatCashFlowSpreadsheetDate(date);
  }

  private parseDate(value: string): Date {
    return parseCashFlowSpreadsheetDate(value);
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
