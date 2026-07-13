import type {
  BankAccountStatus,
  ICashFlowSpreadsheetGateway,
  SheetConfigDTO,
  Transaction,
} from "~/modules/cash-flow/application/ports/ICashFlowSpreadsheetGateway";
import { CashFlowSpreadsheet } from "~/modules/cash-flow/domain/CashFlowSpreadsheet";
import { CashFlowSpreadsheetType } from "~/modules/cash-flow/domain/enums/CashFlowSpreadsheetType";
import type { AuthService } from "~/modules/identity/application/AuthService";
import type { Credential } from "~/modules/identity/domain/Credentials";
import type { User } from "~/modules/identity/domain/User";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import type { DatabaseExecutor } from "~/shared/server/DatabaseExecutor";

export interface CashFlowSyncBankAccountBalanceDTO {
  phoneNumber: string;
  bankAccount: string;
  currentBalance: number;
  category: string;
  description: string;
  date: Date;
}

export interface CashFlowAddExpenseDTO {
  phoneNumber: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

export interface CashFlowAddEarningDTO {
  phoneNumber: string;
  date: Date;
  value: number;
  category: string;
  description: string;
  bankAccount: string;
}

export interface CashFlowTransferDTO {
  phoneNumber: string;
  date: Date;
  value: number;
  description: string;
  from: string;
  to: string;
}

export const DEFAULT_LATEST_TRANSACTIONS_LIMIT = 10;
export const MAX_LATEST_TRANSACTIONS_LIMIT = 50;

export class CashFlowService {
  private database: DatabaseExecutor;
  private authService: AuthService;
  private spreadsheetResource: ICashFlowSpreadsheetGateway;

  constructor(
    database: DatabaseExecutor,
    authService: AuthService,
    spreadsheetResource: ICashFlowSpreadsheetGateway,
  ) {
    this.database = database;
    this.authService = authService;
    this.spreadsheetResource = spreadsheetResource;
  }

  async addSpreadsheetUrl(phoneNumber: string, url: string): Promise<void> {
    const user = await this.authService.getUserByPhoneNumber(phoneNumber);
    if (!user) throw new NotFoundException("User not found");
    const existing = await this.getSpreadsheetByUserId(user.id);
    if (existing) {
      throw new ValidationException(
        "User already has a financial planning spreadsheet configured",
      );
    }
    const sheetId = this.spreadsheetResource.getSpreadsheetIdByUrl(url);
    const sheet = new CashFlowSpreadsheet();
    sheet.idUser = user.id;
    sheet.idSheet = sheetId;
    sheet.type = CashFlowSpreadsheetType.Google;
    await this.createCashFlowSpreadsheet(sheet);
  }

  async getAllTransactions(phoneNumber: string): Promise<Transaction[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getAllTransactions({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async getLatestTransactions(
    phoneNumber: string,
    limit?: number,
  ): Promise<Transaction[]> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    const normalizedLimit =
      typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0
        ? DEFAULT_LATEST_TRANSACTIONS_LIMIT
        : Math.min(Math.floor(limit), MAX_LATEST_TRANSACTIONS_LIMIT);
    return await this.spreadsheetResource.getLatestTransactions(
      { sheetId: sheet.idSheet, sheetAccessToken: credential.accessToken },
      normalizedLimit,
    );
  }

  async getLastTransaction(
    phoneNumber: string,
  ): Promise<Transaction | undefined> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    return await this.spreadsheetResource.getLastTransaction({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async deleteLastTransaction(phoneNumber: string): Promise<void> {
    const { sheet, credential } = await this.getUserAndSheet(phoneNumber);
    await this.spreadsheetResource.deleteLastTransaction({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
    });
  }

  async addExpense(expense: CashFlowAddExpenseDTO): Promise<void> {
    this.validateTransactionInput(expense);
    const { sheet, credential } = await this.getUserAndSheet(
      expense.phoneNumber,
    );
    await this.spreadsheetResource.addExpense({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
      date: expense.date,
      value: expense.value,
      category: expense.category,
      description: expense.description,
      bankAccount: expense.bankAccount,
    });
  }

  async addEarning(earning: CashFlowAddEarningDTO): Promise<void> {
    this.validateTransactionInput(earning);
    const { sheet, credential } = await this.getUserAndSheet(
      earning.phoneNumber,
    );
    await this.spreadsheetResource.addEarning({
      sheetId: sheet.idSheet,
      sheetAccessToken: credential.accessToken,
      date: earning.date,
      value: earning.value,
      category: earning.category,
      description: earning.description,
      bankAccount: earning.bankAccount,
    });
  }

  async transferBetweenBankAccounts(
    transfer: CashFlowTransferDTO,
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
    if (transfer.value <= 0) {
      throw new ValidationException(
        "Transfer value must be a positive number",
        `Received: ${transfer.value}`,
      );
    }
    await this.addExpense({
      phoneNumber: transfer.phoneNumber,
      date: transfer.date,
      value: transfer.value,
      category,
      description: transfer.description,
      bankAccount: transfer.from,
    });
    await this.addEarning({
      phoneNumber: transfer.phoneNumber,
      date: transfer.date,
      value: transfer.value,
      category,
      description: transfer.description,
      bankAccount: transfer.to,
    });
    return category;
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
  ): Promise<BankAccountStatus[]> {
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
    const sheet = await this.getSpreadsheetByUserId(user.id);
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

  private async createCashFlowSpreadsheet(
    sheet: CashFlowSpreadsheet,
  ): Promise<void> {
    await this.database.sql`
      INSERT INTO cash_flow_spreadsheets (id, id_user, id_sheet, type, created_at, updated_at)
      VALUES (${sheet.id}, ${sheet.idUser}, ${sheet.idSheet}, ${sheet.type}, ${sheet.createdAt}, ${sheet.updatedAt})
    `;
  }

  private async getSpreadsheetByUserId(
    userId: string,
  ): Promise<CashFlowSpreadsheet | undefined> {
    const dbEntities = await this.database.sql<DbCashFlowSpreadsheet[]>`
      SELECT * FROM cash_flow_spreadsheets
      WHERE id_user = ${userId}
    `;
    const dbEntity = dbEntities[0];
    if (!dbEntity) return undefined;
    const sheet = new CashFlowSpreadsheet();
    sheet.id = dbEntity.id;
    sheet.idUser = dbEntity.id_user;
    sheet.idSheet = dbEntity.id_sheet;
    sheet.type = dbEntity.type as CashFlowSpreadsheetType;
    sheet.createdAt = dbEntity.created_at;
    sheet.updatedAt = dbEntity.updated_at;
    return sheet;
  }
}

interface DbCashFlowSpreadsheet {
  id: string;
  id_user: string;
  id_sheet: string;
  type: string;
  created_at: Date;
  updated_at: Date;
}
