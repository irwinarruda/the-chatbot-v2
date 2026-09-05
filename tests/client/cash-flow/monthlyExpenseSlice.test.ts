import { describe, expect, test } from "vitest";
import { create } from "zustand";
import type { MonthlyExpenseClientService } from "~/modules/cash-flow/client/services/monthlyExpenseService";
import {
  createMonthlyExpenseSlice,
  type MonthlyExpenseSlice,
} from "~/modules/cash-flow/client/state/monthlyExpenseSlice";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";
import { createDeferred } from "~/tests/utils/createDeferred";

function createExpense(
  patch: Partial<MonthlyExpenseDTO> = {},
): MonthlyExpenseDTO {
  return {
    id: crypto.randomUUID(),
    name: "Rent",
    expectedAmount: 1800,
    dueDay: 5,
    month: "2026-07",
    isPaid: false,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    ...patch,
  };
}

describe("monthlyExpenseSlice", () => {
  test("reduces authoritative create, payment, and archive results", async () => {
    const rent = createExpense();
    const internet = createExpense({ name: "Internet", dueDay: 10 });
    let createdMonth: string | undefined;
    let updatedMonth: string | undefined;
    const listedMonths: Array<string | undefined> = [];
    const service: MonthlyExpenseClientService = {
      async payFromAccount() {
        return rent;
      },
      async list(month) {
        listedMonths.push(month);
        const selectedMonth = month ?? "2026-07";
        return {
          month: selectedMonth,
          expenses: [{ ...rent, month: selectedMonth }],
        };
      },
      async create(dto) {
        createdMonth = dto.month;
        return { ...internet, month: dto.month ?? internet.month };
      },
      async update(_id, dto) {
        updatedMonth = dto.month;
        return {
          ...internet,
          month: dto.month ?? internet.month,
          name: dto.name ?? internet.name,
        };
      },
      async archive() {},
      async setPaid(id, dto) {
        const expense = id === rent.id ? rent : internet;
        return {
          ...expense,
          isPaid: dto.isPaid,
          paidAt: dto.isPaid ? "2026-07-10T12:00:00.000Z" : undefined,
        };
      },
    };
    const store = create<MonthlyExpenseSlice>()(
      createMonthlyExpenseSlice(service),
    );

    await store.getState().bootstrapMonthlyExpenses("2026-06");
    await store.getState().createMonthlyExpense({ name: "Internet" });
    await store
      .getState()
      .updateMonthlyExpense(internet.id, { expectedAmount: 130 });
    await store.getState().setMonthlyExpensePaid(rent.id, true);
    await store.getState().archiveMonthlyExpense(internet.id);

    expect(store.getState().monthlyExpenseMonth).toBe("2026-06");
    expect(store.getState().monthlyExpenses).toEqual([
      expect.objectContaining({ id: rent.id }),
    ]);
    expect(createdMonth).toBe("2026-06");
    expect(updatedMonth).toBe("2026-06");
    expect(listedMonths).toEqual(["2026-06", "2026-06"]);
    expect(store.getState().isMonthlyExpenseSubmitting).toBe(false);
  });
});

function createService(): MonthlyExpenseClientService {
  return {
    async list(month) {
      return { month: month ?? "2026-07", expenses: [] };
    },
    async create() {
      return createExpense();
    },
    async update() {
      return createExpense();
    },
    async archive() {},
    async setPaid() {
      return createExpense();
    },
    async payFromAccount() {
      return createExpense();
    },
  };
}

describe("monthly expense navigation", () => {
  test("ignores an older month's response and loading completion", async () => {
    const june = createDeferred<{
      month: string;
      expenses: MonthlyExpenseDTO[];
    }>();
    const july = createDeferred<{
      month: string;
      expenses: MonthlyExpenseDTO[];
    }>();
    const service = createService();
    service.list = (month) => {
      if (month === "2026-06") return june.promise;
      return july.promise;
    };
    const store = create<MonthlyExpenseSlice>()(
      createMonthlyExpenseSlice(service),
    );
    const juneLoad = store.getState().bootstrapMonthlyExpenses("2026-06");
    const julyLoad = store.getState().bootstrapMonthlyExpenses("2026-07");
    june.resolve({
      month: "2026-06",
      expenses: [createExpense({ month: "2026-06" })],
    });
    await juneLoad;
    expect(store.getState().monthlyExpenseMonth).toBe("2026-07");
    expect(store.getState().isMonthlyExpenseBootstrapping).toBe(true);
    july.resolve({ month: "2026-07", expenses: [] });
    await julyLoad;
    expect(store.getState().monthlyExpenses).toEqual([]);
    expect(store.getState().isMonthlyExpenseBootstrapping).toBe(false);
  });

  test.each(["create", "update", "setPaid"] as const)(
    "%s completing after navigation preserves the selected month's expenses",
    async (operation) => {
      const result = createDeferred<MonthlyExpenseDTO>();
      const expense = createExpense({ month: "2026-06" });
      const service = createService();
      service[operation] = () => result.promise;
      const store = create<MonthlyExpenseSlice>()(
        createMonthlyExpenseSlice(service),
      );
      await store.getState().bootstrapMonthlyExpenses("2026-06");
      let mutation: Promise<MonthlyExpenseDTO | undefined>;
      if (operation === "create")
        mutation = store.getState().createMonthlyExpense({ name: "Rent" });
      else if (operation === "update")
        mutation = store
          .getState()
          .updateMonthlyExpense(expense.id, { name: "Rent" });
      else mutation = store.getState().setMonthlyExpensePaid(expense.id, true);
      await store.getState().bootstrapMonthlyExpenses("2026-07");
      result.resolve(expense);
      await mutation;
      expect(store.getState().monthlyExpenseMonth).toBe("2026-07");
      expect(store.getState().monthlyExpenses).toEqual([]);
      expect(store.getState().isMonthlyExpenseSubmitting).toBe(false);
    },
  );

  test("archive refresh cannot restore a month left during the request", async () => {
    const archived = createDeferred<void>();
    const service = createService();
    service.archive = () => archived.promise;
    const store = create<MonthlyExpenseSlice>()(
      createMonthlyExpenseSlice(service),
    );
    await store.getState().bootstrapMonthlyExpenses("2026-06");
    const mutation = store.getState().archiveMonthlyExpense("rent");
    await store.getState().bootstrapMonthlyExpenses("2026-07");
    archived.resolve(undefined);
    await mutation;
    expect(store.getState().monthlyExpenseMonth).toBe("2026-07");
    expect(store.getState().monthlyExpenses).toEqual([]);
  });
});
