import { describe, expect, test } from "vitest";
import { parseCashFlowDashboard } from "~/modules/cash-flow/client/services/cashFlowService";
import { toCashFlowDashboardResponse } from "~/modules/cash-flow/contracts/CashFlowContractMapper";
import type { CashFlowDashboardDTO } from "~/modules/cash-flow/entities/dtos/CashFlowServiceDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";
import { Printable } from "~/shared/http/utils/Printable";

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
    const wireResponse = JSON.parse(Printable.make(response));

    expect(wireResponse.transactions).toEqual([
      expect.objectContaining({
        position: 0,
        type: CashFlowTransactionType.Expense,
        is_last: false,
      }),
      expect.objectContaining({
        position: 1,
        type: CashFlowTransactionType.Earning,
        is_last: true,
      }),
    ]);
    expect(parseCashFlowDashboard(wireResponse)).toEqual(response);
  });
});
