import { describe, expect, test } from "vitest";
import { create } from "zustand";
import type { MonthlyExpenseClientService } from "~/modules/cash-flow/client/services/monthlyExpenseService";
import {
  createMonthlyExpenseSlice,
  type MonthlyExpenseSlice,
} from "~/modules/cash-flow/client/state/monthlyExpenseSlice";
import type { MonthlyExpense } from "~/modules/cash-flow/contracts/MonthlyExpenseContracts";

function createExpense(patch: Partial<MonthlyExpense> = {}): MonthlyExpense {
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
    const service: MonthlyExpenseClientService = {
      async list() {
        return { month: "2026-07", expenses: [rent] };
      },
      async create() {
        return internet;
      },
      async update(_id, dto) {
        return { ...internet, name: dto.name ?? internet.name };
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

    await store.getState().bootstrapMonthlyExpenses();
    await store.getState().createMonthlyExpense({ name: "Internet" });
    await store.getState().setMonthlyExpensePaid(rent.id, true);
    await store.getState().archiveMonthlyExpense(internet.id);

    expect(store.getState().monthlyExpenseMonth).toBe("2026-07");
    expect(store.getState().monthlyExpenses).toEqual([
      expect.objectContaining({ id: rent.id, isPaid: true }),
    ]);
    expect(store.getState().isMonthlyExpenseSubmitting).toBe(false);
  });
});
