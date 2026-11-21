import { v4 as uuidv4 } from "uuid";
import type { CashFlowSpreadsheetPickerResponseDTO } from "~/contracts/http/cash-flow/cash-flow-spreadsheet";
import type {
  CashFlowAddEarningDTO,
  CashFlowAddExpenseDTO,
  CashFlowAddTransactionDTO,
  CashFlowDashboardDTO,
  CashFlowDeleteTransactionDTO,
  CashFlowSyncBankAccountBalanceDTO,
  CashFlowTransferDTO,
} from "~/domain/cash-flow/cash-flow-commands";
import { formatCashFlowDate } from "~/domain/cash-flow/cash-flow-date";
import { CashFlowSpreadsheet } from "~/domain/cash-flow/cash-flow-spreadsheet";
import { CashFlowSpreadsheetType } from "~/domain/cash-flow/cash-flow-spreadsheet-type";
import type {
  BankAccountStatusDTO,
  SheetConfigDTO,
  TransactionDTO,
} from "~/domain/cash-flow/cash-flow-transaction";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";
import type { Credential } from "~/domain/identity/credentials";
import type { User } from "~/domain/identity/user";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { CashFlowSpreadsheetGateway } from "~/server/modules/cash-flow/gateways/cash-flow-spreadsheet";
import type { CashFlowSpreadsheetRepository } from "~/server/modules/cash-flow/repositories/cash-flow-spreadsheet.repository";
import type { AuthService } from "~/server/modules/identity/services/auth.service";
import type { GoogleSheetsConfig } from "~/server/shared/config/config";
import { NotFoundException } from "~/server/shared/errors/application-errors";

export class CashFlowService {
  constructor(
    private spreadsheets: CashFlowSpreadsheetRepository,
    private authService: AuthService,
    private spreadsheetResource: CashFlowSpreadsheetGateway,
    private googleSheetsConfig: GoogleSheetsConfig,
  ) {}

  createSpreadsheetConnectUrl(url: string): string {
    const sheetId = this.spreadsheetResource.getSpreadsheetIdByUrl(url);
    const connectUrl = new URL(this.googleSheetsConfig.connectUrl);
    connectUrl.searchParams.set("spreadsheet", sheetId);
    return connectUrl.toString();
  }

  async getSpreadsheetPicker(
    phoneNumber: string,
  ): Promise<CashFlowSpreadsheetPickerResponseDTO> {
    const user = await this.authService.getUserByPhoneNumber(phoneNumber);
    if (!user) throw new NotFoundException("User not found");
    await this.ensureSpreadsheetAccess(user);
    if (!user.googleCredential) {
      throw new ValidationException("User is not connected to Google");
    }
    const sheet = await this.spreadsheets.getByUserId(user.id);
    return {
      accessToken: user.googleCredential.accessToken,
      appId: this.googleSheetsConfig.pickerAppId,
      developerKey: this.googleSheetsConfig.pickerApiKey,
      spreadsheetId: sheet?.idSheet,
    };
  }

  async addSpreadsheetUrl(phoneNumber: string, url: string): Promise<void> {
    const user = await this.authService.getUserByPhoneNumber(phoneNumber);
    if (!user) throw new NotFoundException("User not found");
    const sheetId = this.spreadsheetResource.getSpreadsheetIdByUrl(url);
    const existing = await this.spreadsheets.getByUserId(user.id);
    if (existing) {
      existing.idSheet = sheetId;
      existing.updatedAt = new Date();
      await this.spreadsheets.updateSheet(existing);
      return;
    }
    const sheet = new CashFlowSpreadsheet();
    sheet.idUser = user.id;
    sheet.idSheet = sheetId;
    sheet.type = CashFlowSpreadsheetType.Google;
    await this.spreadsheets.create(sheet);
  }

  async getAllTransactions(phoneNumber: string): Promise<TransactionDTO[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getAllTransactions({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async getDashboard(
    phoneNumber: string,
    date = new Date(),
  ): Promise<CashFlowDashboardDTO> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    const sheetConfig = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    const [
      transactions,
      bankAccounts,
      expenseCategories,
      earningCategories,
      bankAccountStatuses,
    ] = await Promise.all([
      this.spreadsheetResource.getAllTransactions(sheetConfig),
      this.spreadsheetResource.getBankAccount(sheetConfig),
      this.spreadsheetResource.getExpenseCategories(sheetConfig),
      this.spreadsheetResource.getEarningCategories(sheetConfig),
      this.spreadsheetResource.getBankAccountsStatus(sheetConfig, date),
    ]);
    return {
      transactions,
      bankAccounts,
      expenseCategories,
      earningCategories,
      bankAccountStatuses,
    };
  }

  async getLatestTransactions(
    phoneNumber: string,
    limit?: number,
  ): Promise<TransactionDTO[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    const sheetConfig = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    if (limit === undefined) {
      return await this.spreadsheetResource.getAllTransactions(sheetConfig);
    }
    return await this.spreadsheetResource.getLatestTransactions(
      sheetConfig,
      Math.floor(limit),
    );
  }

  async getLastTransaction(
    phoneNumber: string,
  ): Promise<TransactionDTO | undefined> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getLastTransaction({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async deleteLastTransaction(phoneNumber: string): Promise<void> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    const config = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    await this.spreadsheets.withLock(config.sheetId, async () => {
      const transactions =
        await this.spreadsheetResource.getAllTransactions(config);
      if (transactions.length === 0) {
        throw new ValidationException(
          "There are no items to be deleted",
          "Verify if deleting is the correct operation",
        );
      }
      await this.removeTransaction(
        config,
        transactions,
        transactions.length - 1,
      );
    });
  }

  async deleteTransaction(
    transaction: CashFlowDeleteTransactionDTO,
  ): Promise<void> {
    const { sheet, credential } = await this.getUserAndSheet(
      transaction.phoneNumber,
    );
    const config = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    await this.spreadsheets.withLock(config.sheetId, async () => {
      const transactions =
        await this.spreadsheetResource.getAllTransactions(config);
      const current = transactions[transaction.position];
      if (
        !current ||
        formatCashFlowDate(current.date) !==
          formatCashFlowDate(transaction.date) ||
        current.value !== transaction.value ||
        current.category !== transaction.category ||
        current.description !== transaction.description ||
        current.bankAccount !== transaction.bankAccount
      ) {
        throw new ValidationException(
          "This transaction changed in the spreadsheet",
          "Reload the cash flow and try again",
        );
      }
      await this.removeTransaction(config, transactions, transaction.position);
    });
  }

  async addTransaction(transaction: CashFlowAddTransactionDTO): Promise<void> {
    if (transaction.type === CashFlowTransactionType.Expense) {
      await this.addExpense(transaction);
      return;
    }
    await this.addEarning(transaction);
  }

  async addExpense(expense: CashFlowAddExpenseDTO): Promise<void> {
    this.validateTransactionInput(expense);
    const { sheet, credential } = await this.getUserAndSheet(
      expense.phoneNumber,
    );
    await this.spreadsheets.withLock(sheet.idSheet, () =>
      this.spreadsheetResource.addExpense({
        sheetId: sheet.idSheet,
        sheetAccessToken: credential.accessToken,
        date: expense.date,
        value: expense.value,
        category: expense.category,
        description: expense.description,
        bankAccount: expense.bankAccount,
      }),
    );
  }

  async addEarning(earning: CashFlowAddEarningDTO): Promise<void> {
    this.validateTransactionInput(earning);
    const { sheet, credential } = await this.getUserAndSheet(
      earning.phoneNumber,
    );
    await this.spreadsheets.withLock(sheet.idSheet, () =>
      this.spreadsheetResource.addEarning({
        sheetId: sheet.idSheet,
        sheetAccessToken: credential.accessToken,
        date: earning.date,
        value: earning.value,
        category: earning.category,
        description: earning.description,
        bankAccount: earning.bankAccount,
      }),
    );
  }

  async transferBetweenBankAccounts(
    transfer: CashFlowTransferDTO,
    replace = false,
  ): Promise<string> {
    const { sheet, credential } = await this.getUserAndSheet(
      transfer.phoneNumber,
    );
    const sheetConfig = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    const [bankAccounts, category] = await Promise.all([
      this.spreadsheetResource.getBankAccount(sheetConfig),
      this.spreadsheetResource.getTransferCategory(sheetConfig),
    ]);
    this.validateBankAccountExists(transfer.from, bankAccounts, "Source");
    this.validateBankAccountExists(transfer.to, bankAccounts, "Destination");
    if (transfer.from === transfer.to) {
      throw new ValidationException(
        "Source and destination bank accounts cannot be the same",
        "The transfer must be between two different bank accounts.",
      );
    }
    if (
      !Number.isFinite(transfer.value) ||
      transfer.value <= 0 ||
      Number.isNaN(transfer.date.getTime())
    ) {
      throw new ValidationException("Transfer amount and date must be valid");
    }
    await this.spreadsheets.withLock(sheet.idSheet, () =>
      this.spreadsheetResource.saveTransfer(
        {
          ...sheetConfig,
          ...transfer,
          id: transfer.id ?? uuidv4(),
          category,
        },
        replace,
      ),
    );
    return category;
  }

  async deleteTransfer(phoneNumber: string, id: string): Promise<void> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    const config = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    await this.spreadsheets.withLock(config.sheetId, async () => {
      const transactions =
        await this.spreadsheetResource.getAllTransactions(config);
      const position = transactions.findIndex((item) => item.transferId === id);
      if (position < 0) return;
      await this.removeTransaction(config, transactions, position);
    });
  }

  async payBill(
    expense: CashFlowAddExpenseDTO,
    paymentId: string,
  ): Promise<TransactionDTO> {
    this.validateTransactionInput(expense);
    const { sheet, credential } = await this.getUserAndSheet(
      expense.phoneNumber,
    );
    const config = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    const [accounts, categories] = await Promise.all([
      this.spreadsheetResource.getBankAccount(config),
      this.spreadsheetResource.getExpenseCategories(config),
    ]);
    this.validateBankAccountExists(expense.bankAccount, accounts, "Payment");
    if (!categories.includes(expense.category))
      throw new ValidationException("Expense category not found");
    return this.spreadsheets.withLock(sheet.idSheet, () =>
      this.spreadsheetResource.addBillPayment({
        ...config,
        ...expense,
        paymentId,
      }),
    );
  }

  async getExpenseCategories(phoneNumber: string): Promise<string[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getExpenseCategories({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async getEarningCategories(phoneNumber: string): Promise<string[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getEarningCategories({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async getBankAccount(phoneNumber: string): Promise<string[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getBankAccount({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async getBankAccountsStatus(
    phoneNumber: string,
    date = new Date(),
  ): Promise<BankAccountStatusDTO[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getBankAccountsStatus(
      { sheetId: sheet.idSheet, sheetAccessToken: credential.accessToken },
      date,
    );
  }

  async syncBankAccountBalance(
    dto: CashFlowSyncBankAccountBalanceDTO,
  ): Promise<void> {
    const [bankAccounts, statuses] = await Promise.all([
      this.getBankAccount(dto.phoneNumber),
      this.getBankAccountsStatus(dto.phoneNumber, dto.date),
    ]);
    this.validateBankAccountExists(dto.bankAccount, bankAccounts, "Target");
    const accountStatus = statuses.find(
      (s) => s.bankAccount === dto.bankAccount,
    );
    const difference = dto.currentBalance - (accountStatus?.balance ?? 0);
    if (difference === 0) {
      throw new ValidationException(
        `Bank account "${dto.bankAccount}" is already in sync`,
        `The spreadsheet balance matches the reported balance of ${dto.currentBalance}. No adjustment needed.`,
      );
    }
    if (difference > 0) {
      await this.addEarning({
        phoneNumber: dto.phoneNumber,
        date: dto.date,
        value: difference,
        category: dto.category,
        description: dto.description,
        bankAccount: dto.bankAccount,
      });
    } else {
      await this.addExpense({
        phoneNumber: dto.phoneNumber,
        date: dto.date,
        value: Math.abs(difference),
        category: dto.category,
        description: dto.description,
        bankAccount: dto.bankAccount,
      });
    }
  }

  async getCategoriesAndBankAccounts(
    phoneNumber: string,
  ): Promise<{ categories: string[]; bankAccounts: string[] }> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    const cfg: SheetConfigDTO = {
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    };
    const [expenseCategories, earningCategories, bankAccounts] =
      await Promise.all([
        this.spreadsheetResource.getExpenseCategories(cfg),
        this.spreadsheetResource.getEarningCategories(cfg),
        this.spreadsheetResource.getBankAccount(cfg),
      ]);
    const categories = [
      ...new Set([...expenseCategories, ...earningCategories]),
    ];
    return { categories, bankAccounts };
  }

  private async removeTransaction(
    config: SheetConfigDTO,
    transactions: TransactionDTO[],
    position: number,
  ): Promise<void> {
    const { transferId, paymentId } = transactions[position];
    if (paymentId) {
      throw new ValidationException(
        "This transaction is linked to a bill payment",
      );
    }
    const positions = transferId
      ? this.getTransferPositions(transactions, transferId)
      : [position];
    await this.spreadsheetResource.deleteTransactions(config, positions);
  }

  private getTransferPositions(
    transactions: TransactionDTO[],
    id: string,
  ): number[] {
    const positions = transactions.flatMap((item, position) =>
      item.transferId === id ? [position] : [],
    );
    if (positions.length !== 2) {
      throw new ValidationException("The transfer is missing a linked entry");
    }
    return positions;
  }

  private validateTransactionInput(
    transaction: CashFlowAddExpenseDTO | CashFlowAddEarningDTO,
  ): void {
    if (!Number.isFinite(transaction.value) || transaction.value <= 0) {
      throw new ValidationException("Transaction value must be positive");
    }
    if (Number.isNaN(transaction.date.getTime())) {
      throw new ValidationException("Transaction date is invalid");
    }
    if (
      !transaction.category.trim() ||
      !transaction.description.trim() ||
      !transaction.bankAccount.trim()
    ) {
      throw new ValidationException(
        "Transaction category, description, and bank account are required",
      );
    }
  }

  private validateBankAccountExists(
    accountName: string,
    existingAccounts: string[],
    label: string,
  ): void {
    if (!existingAccounts.includes(accountName)) {
      throw new ValidationException(
        `${label} bank account "${accountName}" not found in the spreadsheet`,
        "Available accounts: " +
          existingAccounts.join(", ") +
          ". Make sure the account name matches exactly.",
      );
    }
  }

  private async getUserAndSheet(phoneNumber: string): Promise<{
    user: User;
    sheet: CashFlowSpreadsheet;
    credential: Credential;
  }> {
    const user = await this.authService.getUserByPhoneNumber(phoneNumber);
    if (!user) throw new NotFoundException("User was not found");
    await this.ensureSpreadsheetAccess(user);
    if (!user.googleCredential) {
      throw new ValidationException("User is not connected to Google");
    }
    const sheet = await this.spreadsheets.getByUserId(user.id);
    if (!sheet) {
      throw new ValidationException(
        "User does not have a financial planning spreadsheet configured",
        "Add a spreadsheet for this user first",
      );
    }
    return { user, sheet, credential: user.googleCredential };
  }

  private async ensureSpreadsheetAccess(user: User): Promise<void> {
    if (!user.googleCredential) {
      throw new ValidationException("User is not connected to Google");
    }
    if (
      user.googleCredential.expirationDate &&
      user.googleCredential.expirationDate <= new Date()
    ) {
      await this.authService.refreshGoogleCredential(user);
    }
  }
}
