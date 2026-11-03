import { mockDb } from "~/client/mock/db";
import type { CashFlowRepository } from "~/client/modules/cash-flow/app/repositories/CashFlowRepository";
import type { CreateCashFlowTransactionRequestDTO } from "~/contracts/http/cash-flow/cash-flow";

export class TestCashFlowRepository implements CashFlowRepository {
  async load() {
    return mockDb.cashFlow;
  }

  async create(dto: CreateCashFlowTransactionRequestDTO) {
    const { transactions } = mockDb.cashFlow;
    for (const transaction of transactions) transaction.isLast = false;
    transactions.push({
      position: transactions.length,
      date: dto.date,
      value: dto.type === "Expense" ? -Math.abs(dto.value) : dto.value,
      type: dto.type,
      category: dto.category,
      description: dto.description,
      bankAccount: dto.bankAccount,
      isLast: true,
    });
  }

  async sync() {}

  async deleteLast() {
    const { transactions } = mockDb.cashFlow;
    transactions.pop();
    const last = transactions[transactions.length - 1];
    if (last) last.isLast = true;
  }

  async saveTransfer() {}

  async deleteTransfer() {}
}
