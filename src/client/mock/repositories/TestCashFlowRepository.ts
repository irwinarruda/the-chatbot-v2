import { mockDb } from "~/client/mock/db";
import type { CashFlowRepository } from "~/client/modules/cash-flow/app/repositories/CashFlowRepository";
import type {
  CashFlowTransactionResponseDTO,
  CreateCashFlowTransactionRequestDTO,
} from "~/contracts/http/cash-flow/cash-flow";

export class TestCashFlowRepository implements CashFlowRepository {
  async load() {
    return mockDb.cashFlow;
  }

  async create(dto: CreateCashFlowTransactionRequestDTO) {
    const { transactions } = mockDb.cashFlow;
    transactions.push({
      position: transactions.length,
      date: dto.date,
      value: dto.type === "Expense" ? -Math.abs(dto.value) : dto.value,
      type: dto.type,
      category: dto.category,
      description: dto.description,
      bankAccount: dto.bankAccount,
    });
  }

  async sync() {}

  async deleteTransaction(transaction: CashFlowTransactionResponseDTO) {
    mockDb.cashFlow.transactions = mockDb.cashFlow.transactions
      .filter((item) => item.position !== transaction.position)
      .map((item, position) => ({ ...item, position }));
  }

  async saveTransfer() {}

  async deleteTransfer() {}

  async getSpreadsheetPicker() {
    return { accessToken: "demo-token", appId: "", developerKey: "" };
  }

  async connectSpreadsheet() {}
}
