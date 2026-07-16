import { describe, expect, test } from "vitest";
import { create } from "zustand";
import type { MonthlyExpenseClientService } from "~/modules/cash-flow/client/services/monthlyExpenseService";
import {
  createMonthlyExpenseSlice,
  type MonthlyExpenseSlice,
} from "~/modules/cash-flow/client/state/monthlyExpenseSlice";
import type { MonthlyExpenseDTO } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseDTO";

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
