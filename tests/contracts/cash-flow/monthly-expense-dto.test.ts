import { describe, expect, test } from "vitest";
import { parseMonthlyExpense } from "~/client/modules/cash-flow/app/repositories/ApiMonthlyExpenseRepository";
import { toMonthlyExpenseResponse } from "~/contracts/http/cash-flow/monthly-expense-mapper";
import { MonthlyExpense } from "~/domain/cash-flow/monthly-expense";
import type { MonthlyExpenseItemDTO } from "~/domain/cash-flow/monthly-expense-commands";

describe("Monthly expense contracts", () => {
  test("maps serialized monthly bills through the client contract", () => {
    const item: MonthlyExpenseItemDTO = {
      expense: new MonthlyExpense({
        idUser: crypto.randomUUID(),
        name: "Electricity",
        expectedAmount: 180.5,
        dueDay: 15,
      }),
      month: "2026-07",
      isPaid: true,
      paidAt: new Date("2026-07-10T12:00:00.000Z"),
    };
    const response = toMonthlyExpenseResponse(item);
    const wireResponse = JSON.parse(JSON.stringify(response));

    expect(wireResponse).toMatchObject({
      expectedAmount: 180.5,
      dueDay: 15,
      isPaid: true,
      paidAt: "2026-07-10T12:00:00.000Z",
    });
    expect(parseMonthlyExpense(wireResponse)).toEqual(response);
  });
});
