import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import type { CashFlowRepository } from "~/client/modules/cash-flow/app/repositories/CashFlowRepository";
import {
  type CashFlowService,
  createCashFlowService,
} from "~/client/modules/cash-flow/app/services/CashFlowService";
import { container } from "~/client/shared/container";
import type { CashFlowDashboardResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";
import { createDeferred } from "~/tests/support/create-deferred";

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

const spreadsheetPort = {
  async getSpreadsheetPicker() {
    return { accessToken: "token", appId: "app", developerKey: "key" };
  },
  async connectSpreadsheet() {},
};

describe("cashFlowSlice", () => {
  test("refreshes authoritative spreadsheet data after every mutation", async () => {
    let loadCount = 0;
    const service: CashFlowRepository = {
      ...spreadsheetPort,
      async saveTransfer() {},
      async deleteTransfer() {},
      load: vi.fn(async () => createDashboard(loadCount++)),
      create: vi.fn(async () => {}),
      sync: vi.fn(async () => {}),
      deleteLast: vi.fn(async () => {}),
    };
    container.register("CashFlowRepository", service);
    const store = create<CashFlowService>()(createCashFlowService);

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
    const service: CashFlowRepository = {
      ...spreadsheetPort,
      async saveTransfer() {},
      async deleteTransfer() {},
      async load() {
        loadCount += 1;
        if (loadCount > 1) throw new Error("refresh failed");
        return createDashboard(0);
      },
      async create() {},
      async sync() {},
      async deleteLast() {},
    };
    container.register("CashFlowRepository", service);
    const store = create<CashFlowService>()(createCashFlowService);
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
    const service: CashFlowRepository = {
      ...spreadsheetPort,
      async saveTransfer() {},
      async deleteTransfer() {},
      async load() {
        loadCount += 1;
        if (loadCount > 1) throw new Error("refresh failed");
        return createDashboard(0);
      },
      async create() {},
      async sync() {},
      deleteLast: vi.fn(async () => {}),
    };
    container.register("CashFlowRepository", service);
    const store = create<CashFlowService>()(createCashFlowService);
    await store.getState().bootstrapCashFlow();

    const deleted = await store.getState().deleteLastCashFlowTransaction();
    const retried = await store.getState().deleteLastCashFlowTransaction();

    expect(deleted).toBe(true);
    expect(retried).toBe(false);
    expect(service.deleteLast).toHaveBeenCalledOnce();
    expect(store.getState().cashFlowDashboard.transactions).toEqual([]);
    expect(store.getState().cashFlowError).toBe("loading");
  });
  test("reset stops a pending mutation from refreshing or clearing new loading state", async () => {
    const mutation = createDeferred<void>();
    const dashboard = createDeferred<CashFlowDashboardResponseDTO>();
    const service: CashFlowRepository = {
      ...spreadsheetPort,
      async create() {},
      async sync() {},
      async deleteLast() {},
      async saveTransfer() {},
      deleteTransfer: () => mutation.promise,
      load: vi.fn(() => dashboard.promise),
    };
    container.register("CashFlowRepository", service);
    const store = create<CashFlowService>()(createCashFlowService);
    const old = store.getState().deleteCashFlowTransfer("transfer");
    store.getState().resetCashFlow();
    const loading = store.getState().bootstrapCashFlow();
    mutation.resolve();
    expect(await old).toBe(false);
    expect(service.load).toHaveBeenCalledOnce();
    expect(store.getState().isCashFlowBootstrapping).toBe(true);
    dashboard.resolve(createDashboard(1));
    await loading;
    expect(store.getState().cashFlowDashboard.transactions[0].position).toBe(1);
  });

  test("a late bootstrap cannot overwrite the post-mutation dashboard", async () => {
    const old = createDeferred<CashFlowDashboardResponseDTO>();
    const service: CashFlowRepository = {
      ...spreadsheetPort,
      async create() {},
      async sync() {},
      async deleteLast() {},
      async saveTransfer() {},
      async deleteTransfer() {},
      load: vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce(createDashboard(2)),
    };
    container.register("CashFlowRepository", service);
    const store = create<CashFlowService>()(createCashFlowService);
    const loading = store.getState().bootstrapCashFlow();
    await store.getState().deleteCashFlowTransfer("transfer");
    old.resolve(createDashboard(1));
    await loading;
    expect(store.getState().cashFlowDashboard.transactions[0].position).toBe(2);
  });

  test("links the spreadsheet the user picks, opening the picker on the requested file", async () => {
    const pickSpreadsheet = vi.fn(
      async () => "https://docs.google.com/spreadsheets/d/picked/edit",
    );
    const connectSpreadsheet = vi.fn(async () => {});
    container.register("CashFlowRepository", {
      ...spreadsheetPort,
      async getSpreadsheetPicker() {
        return {
          accessToken: "token",
          appId: "app",
          developerKey: "key",
          spreadsheetId: "linked",
        };
      },
      connectSpreadsheet,
      async saveTransfer() {},
      async deleteTransfer() {},
      load: vi.fn(async () => createDashboard(0)),
      create: vi.fn(async () => {}),
      sync: vi.fn(async () => {}),
      deleteLast: vi.fn(async () => {}),
    });
    container.register("SpreadsheetPickerGateway", { pickSpreadsheet });
    const store = create<CashFlowService>()(createCashFlowService);

    await expect(
      store.getState().connectCashFlowSpreadsheet("requested"),
    ).resolves.toBe(true);
    await store.getState().connectCashFlowSpreadsheet();

    expect(pickSpreadsheet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ spreadsheetId: "requested" }),
    );
    expect(pickSpreadsheet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ spreadsheetId: "linked" }),
    );
    expect(connectSpreadsheet).toHaveBeenCalledWith(
      "https://docs.google.com/spreadsheets/d/picked/edit",
    );
    expect(store.getState().isCashFlowSubmitting).toBe(false);
  });

  test("links nothing when the user closes the picker, and reports a failed link", async () => {
    const connectSpreadsheet = vi.fn(async () => {
      throw new Error("offline");
    });
    container.register("CashFlowRepository", {
      ...spreadsheetPort,
      connectSpreadsheet,
      async saveTransfer() {},
      async deleteTransfer() {},
      load: vi.fn(async () => createDashboard(0)),
      create: vi.fn(async () => {}),
      sync: vi.fn(async () => {}),
      deleteLast: vi.fn(async () => {}),
    });
    const pickSpreadsheet = vi.fn<() => Promise<string | undefined>>(
      async () => undefined,
    );
    container.register("SpreadsheetPickerGateway", { pickSpreadsheet });
    const store = create<CashFlowService>()(createCashFlowService);

    await expect(store.getState().connectCashFlowSpreadsheet()).resolves.toBe(
      false,
    );
    expect(connectSpreadsheet).not.toHaveBeenCalled();
    expect(store.getState().cashFlowError).toBeUndefined();

    pickSpreadsheet.mockResolvedValue(
      "https://docs.google.com/spreadsheets/d/picked/edit",
    );
    await expect(store.getState().connectCashFlowSpreadsheet()).resolves.toBe(
      false,
    );
    expect(store.getState().cashFlowError).toBe("connecting");
  });
});
