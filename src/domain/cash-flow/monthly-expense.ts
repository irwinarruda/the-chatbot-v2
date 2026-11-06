import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/domain/shared/domain-errors";

export interface MonthlyExpenseConfig {
  id?: string;
  idUser: string;
  name: string;
  expectedAmount?: number;
  dueDay?: number;
  category?: string;
  defaultBankAccount?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RestoredMonthlyExpenseConfig {
  id: string;
  idUser: string;
  name: string;
  expectedAmount?: number;
  dueDay?: number;
  category?: string;
  defaultBankAccount?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MonthlyExpense {
  id: string;
  idUser: string;
  name: string;
  expectedAmount?: number;
  dueDay?: number;
  category?: string;
  defaultBankAccount?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(config: MonthlyExpenseConfig) {
    if (!config.idUser) {
      throw new ValidationException("Monthly expense owner is required");
    }
    this.id = config.id ?? uuidv4();
    this.idUser = config.idUser;
    this.name = this.validateText("name", config.name);
    this.expectedAmount = this.validateExpectedAmount(config.expectedAmount);
    this.dueDay = this.validateDueDay(config.dueDay);
    this.category = this.validateOptionalText("category", config.category);
    this.defaultBankAccount = this.validateOptionalText(
      "default bank account",
      config.defaultBankAccount,
    );
    this.createdAt = config.createdAt ?? new Date();
    this.updatedAt = config.updatedAt ?? new Date();
  }

  static restore(config: RestoredMonthlyExpenseConfig): MonthlyExpense {
    return new MonthlyExpense(config);
  }

  rename(name: string): void {
    this.name = this.validateText("name", name);
    this.updatedAt = new Date();
  }

  changeExpectedAmount(expectedAmount?: number): void {
    this.expectedAmount = this.validateExpectedAmount(expectedAmount);
    this.updatedAt = new Date();
  }

  changeDueDay(dueDay?: number): void {
    this.dueDay = this.validateDueDay(dueDay);
    this.updatedAt = new Date();
  }

  changeCategory(category?: string): void {
    this.category = this.validateOptionalText("category", category);
    this.updatedAt = new Date();
  }

  changeDefaultBankAccount(defaultBankAccount?: string): void {
    this.defaultBankAccount = this.validateOptionalText(
      "default bank account",
      defaultBankAccount,
    );
    this.updatedAt = new Date();
  }

  private validateText(field: string, text: string): string {
    const value = text.trim();
    if (!value || value.length > 160) {
      throw new ValidationException(
        `Monthly expense ${field} must be present and have at most 160 characters`,
      );
    }
    return value;
  }

  private validateOptionalText(
    field: string,
    text?: string,
  ): string | undefined {
    if (text === undefined) return undefined;
    return this.validateText(field, text);
  }

  private validateExpectedAmount(expectedAmount?: number): number | undefined {
    if (expectedAmount === undefined) return undefined;
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      throw new ValidationException(
        "Monthly expense expected amount must be a positive number",
      );
    }
    return Math.round(expectedAmount * 100) / 100;
  }

  private validateDueDay(dueDay?: number): number | undefined {
    if (dueDay === undefined) return undefined;
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      throw new ValidationException(
        "Monthly expense due day must be between 1 and 31",
      );
    }
    return dueDay;
  }
}
