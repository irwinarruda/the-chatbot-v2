import { describe, expect, test } from "vitest";
import { parseCashFlowDashboard } from "~/client/modules/cash-flow/app/repositories/ApiCashFlowRepository";
import { DeleteCashFlowTransactionRequestDTO } from "~/contracts/http/cash-flow/cash-flow";
import { toCashFlowDashboardResponse } from "~/contracts/http/cash-flow/cash-flow-mapper";
import type { CashFlowDashboardDTO } from "~/domain/cash-flow/cash-flow-commands";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";

describe("Cash flow web contracts", () => {
  test("maps transaction order and types through the wire contract", () => {
    const dashboard: CashFlowDashboardDTO = {
      transactions: [
        {
          sheetId: "sheet-1",
          date: new Date("2026-07-01T12:00:00.000Z"),
          value: -50,
          category: "Food",
          description: "Lunch",
          bankAccount: "NuConta",
        },
        {
          sheetId: "sheet-1",
          date: new Date("2026-07-02T12:00:00.000Z"),
          value: 100,
          category: "Income",
          description: "Refund",
          bankAccount: "NuConta",
        },
      ],
      bankAccounts: ["NuConta"],
      expenseCategories: ["Food"],
      earningCategories: ["Income"],
      bankAccountStatuses: [{ bankAccount: "NuConta", balance: 50 }],
    };
    const response = toCashFlowDashboardResponse(dashboard);
    const wireResponse = JSON.parse(JSON.stringify(response));

    expect(wireResponse.transactions).toEqual([
      expect.objectContaining({
        position: 0,
        date: "2026-07-01",
        type: CashFlowTransactionType.Expense,
      }),
      expect.objectContaining({
        position: 1,
        date: "2026-07-02",
        type: CashFlowTransactionType.Earning,
      }),
    ]);
    expect(parseCashFlowDashboard(wireResponse)).toEqual(response);
  });

  test("identifies the transaction to delete by what the user saw", () => {
    const transaction = {
      position: 3,
      transferId: "a5337eac-71f5-4cce-9a4e-f2e4a95d789f",
      date: "2026-07-02",
      value: -25.5,
      type: CashFlowTransactionType.Expense,
      category: "Food",
      description: "Lunch",
      bankAccount: "NuConta",
    };

    expect(DeleteCashFlowTransactionRequestDTO.parse(transaction)).toEqual({
      date: "2026-07-02",
      value: -25.5,
      category: "Food",
      description: "Lunch",
      bankAccount: "NuConta",
    });
    expect(
      DeleteCashFlowTransactionRequestDTO.safeParse({
        ...transaction,
        date: "02/07/2026",
      }).success,
    ).toBe(false);
  });
});
