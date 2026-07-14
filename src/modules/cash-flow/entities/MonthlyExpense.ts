import { v4 as uuidv4 } from "uuid";
import { ValidationException } from "~/shared/errors/DomainErrors";

export interface MonthlyExpenseConfig {
  id?: string;
  idUser: string;
  name: string;
  expectedAmount?: number;
  dueDay?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RestoredMonthlyExpenseConfig {
  id: string;
  idUser: string;
  name: string;
  expectedAmount?: number;
  dueDay?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MonthlyExpense {
  id: string;
  idUser: string;
  name: string;
  expectedAmount?: number;
  dueDay?: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(config: MonthlyExpenseConfig) {
    if (!config.idUser) {
      throw new ValidationException("Monthly expense owner is required");
    }
    this.id = config.id ?? uuidv4();
    this.idUser = config.idUser;
    this.name = this.validateName(config.name);
    this.expectedAmount = this.validateExpectedAmount(config.expectedAmount);
    this.dueDay = this.validateDueDay(config.dueDay);
    this.createdAt = config.createdAt ?? new Date();
    this.updatedAt = config.updatedAt ?? new Date();
  }

  static restore(config: RestoredMonthlyExpenseConfig): MonthlyExpense {
    return new MonthlyExpense(config);
  }

  rename(name: string): void {
    this.name = this.validateName(name);
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

  private validateName(name: string): string {
    const value = name.trim();
    if (!value || value.length > 160) {
      throw new ValidationException(
        "Monthly expense name must be present and have at most 160 characters",
      );
    }
    return value;
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
