import {
  CashFlowSpreadsheet,
  CashFlowSpreadsheetType,
} from "~/entities/CashFlowSpreadsheet";
import type { Credential } from "~/entities/Credentials";
import type { User } from "~/entities/User";
import type { Database } from "~/infra/database";
import { NotFoundException, ValidationException } from "~/infra/exceptions";
import type {
  ICashFlowSpreadsheetGateway,
  SheetConfigDTO,
  Transaction,
} from "~/resources/ICashFlowSpreadsheetGateway";
import type { AuthService } from "~/services/AuthService";

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

export class CashFlowService {
  private database: Database;
  private authService: AuthService;
  private spreadsheetResource: ICashFlowSpreadsheetGateway;

  constructor(
    database: Database,
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
    if (existing != null) {
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
    if (user.googleCredential == null) {
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
