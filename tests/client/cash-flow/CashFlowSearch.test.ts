import { describe, expect, test } from "vitest";
import {
  filterCashFlowTransactions,
  normalizeCashFlowSearch,
} from "~/modules/cash-flow/client/CashFlowSearch";
import type { CashFlowTransactionResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";

const transactions: CashFlowTransactionResponseDTO[] = [
  {
    position: 0,
    date: "2026-06-30T12:00:00.000Z",
    value: -25,
    type: CashFlowTransactionType.Expense,
    category: "Food",
    description: "Lunch",
    bankAccount: "NuConta",
    isLast: false,
  },
  {
    position: 1,
    date: "2026-07-02T12:00:00.000Z",
    value: 200,
    type: CashFlowTransactionType.Earning,
    category: "Refund",
    description: "Store refund",
    bankAccount: "Caju",
    isLast: true,
  },
];

describe("CashFlowSearch", () => {
  test("normalizes supported filters and discards invalid values", () => {
    expect(
      normalizeCashFlowSearch({
        q: "refund",
        type: "Unknown",
        bankAccount: "Caju",
        from: "not-a-date",
        to: "2026-07-31",
      }),
    ).toEqual({
      q: "refund",
      type: "all",
      bankAccount: "Caju",
      category: undefined,
      from: undefined,
      to: "2026-07-31",
    });
  });

  test("filters the full ledger and returns newest transactions first", () => {
    expect(
      filterCashFlowTransactions(transactions, {
        q: "refund",
        type: CashFlowTransactionType.Earning,
        bankAccount: "Caju",
        category: "Refund",
        from: "2026-07-01",
        to: "2026-07-31",
      }),
    ).toEqual([transactions[1]]);
    expect(
      filterCashFlowTransactions(transactions, {
        q: "",
        type: "all",
        bankAccount: "",
        category: "",
        from: "",
        to: "",
      }).map((transaction) => transaction.position),
    ).toEqual([1, 0]);
  });
});
