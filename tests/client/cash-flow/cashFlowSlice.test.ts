import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import type { CashFlowClientService } from "~/modules/cash-flow/client/services/cashFlowService";
import {
  type CashFlowSlice,
  createCashFlowSlice,
} from "~/modules/cash-flow/client/state/cashFlowSlice";
import type { CashFlowDashboardResponseDTO } from "~/modules/cash-flow/entities/dtos/CashFlowWebDTO";
import { CashFlowTransactionType } from "~/modules/cash-flow/entities/enums/CashFlowTransactionType";

function createDashboard(position: number): CashFlowDashboardResponseDTO {
  return {
    transactions: [
      {
        position,
        date: "2026-07-02",
        value: 200,
        type: CashFlowTransactionType.Earning,
        category: "Refund",
        description: "Store refund",
        bankAccount: "NuConta",
        isLast: true,
      },
    ],
    bankAccounts: ["NuConta"],
    expenseCategories: ["Food"],
    earningCategories: ["Refund"],
    bankAccountStatuses: [{ bankAccount: "NuConta", balance: 200 }],
  };
}

describe("cashFlowSlice", () => {
  test("refreshes authoritative spreadsheet data after every mutation", async () => {
    let loadCount = 0;
    const service: CashFlowClientService = {
      load: vi.fn(async () => createDashboard(loadCount++)),
      create: vi.fn(async () => {}),
      sync: vi.fn(async () => {}),
      deleteLast: vi.fn(async () => {}),
    };
    const store = create<CashFlowSlice>()(createCashFlowSlice(service));

    await store.getState().bootstrapCashFlow();
    await store.getState().createCashFlowTransaction({
      type: CashFlowTransactionType.Expense,
      date: "2026-07-03",
      value: 50,
      category: "Food",
      description: "Lunch",
      bankAccount: "NuConta",
    });
    await store.getState().syncCashFlowBankAccount({
      date: "2026-07-03",
      currentBalance: 100,
      category: "Refund",
      description: "Balance adjustment",
      bankAccount: "NuConta",
    });
    await store.getState().deleteLastCashFlowTransaction();

    expect(service.create).toHaveBeenCalledOnce();
    expect(service.sync).toHaveBeenCalledOnce();
    expect(service.deleteLast).toHaveBeenCalledOnce();
    expect(service.load).toHaveBeenCalledTimes(4);
    expect(store.getState().cashFlowDashboard.transactions[0]?.position).toBe(
      3,
    );
    expect(store.getState().isCashFlowSubmitting).toBe(false);
  });

  test("keeps a successful mutation distinct from a failed refresh", async () => {
    let loadCount = 0;
    const service: CashFlowClientService = {
      async load() {
        loadCount += 1;
        if (loadCount > 1) throw new Error("refresh failed");
        return createDashboard(0);
      },
      async create() {},
      async sync() {},
      async deleteLast() {},
    };
    const store = create<CashFlowSlice>()(createCashFlowSlice(service));
    await store.getState().bootstrapCashFlow();

    const created = await store.getState().createCashFlowTransaction({
      type: CashFlowTransactionType.Expense,
      date: "2026-07-03",
      value: 50,
      category: "Food",
      description: "Lunch",
      bankAccount: "NuConta",
    });

    expect(created).toBe(true);
    expect(store.getState().cashFlowError).toBe("loading");
  });

  test("invalidates the stale delete target when refresh fails", async () => {
    let loadCount = 0;
    const service: CashFlowClientService = {
      async load() {
        loadCount += 1;
        if (loadCount > 1) throw new Error("refresh failed");
        return createDashboard(0);
      },
      async create() {},
      async sync() {},
      deleteLast: vi.fn(async () => {}),
    };
    const store = create<CashFlowSlice>()(createCashFlowSlice(service));
    await store.getState().bootstrapCashFlow();

    const deleted = await store.getState().deleteLastCashFlowTransaction();
    const retried = await store.getState().deleteLastCashFlowTransaction();

    expect(deleted).toBe(true);
    expect(retried).toBe(false);
    expect(service.deleteLast).toHaveBeenCalledOnce();
    expect(store.getState().cashFlowDashboard.transactions).toEqual([]);
    expect(store.getState().cashFlowError).toBe("loading");
  });
});
