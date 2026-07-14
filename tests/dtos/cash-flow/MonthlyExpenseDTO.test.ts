import { describe, expect, test } from "vitest";
import { parseMonthlyExpense } from "~/modules/cash-flow/client/services/monthlyExpenseService";
import { toMonthlyExpenseResponse } from "~/modules/cash-flow/contracts/MonthlyExpenseContractMapper";
import type { MonthlyExpenseItem } from "~/modules/cash-flow/entities/dtos/MonthlyExpenseServiceDTO";
import { MonthlyExpense } from "~/modules/cash-flow/entities/MonthlyExpense";
import { Printable } from "~/shared/http/utils/Printable";

describe("Monthly expense contracts", () => {
  test("maps serialized monthly bills through the client contract", () => {
    const item: MonthlyExpenseItem = {
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
    const wireResponse = JSON.parse(Printable.make(response));

    expect(wireResponse).toMatchObject({
      expected_amount: 180.5,
      due_day: 15,
      is_paid: true,
      paid_at: "2026-07-10T12:00:00.000Z",
    });
    expect(parseMonthlyExpense(wireResponse)).toEqual(response);
  });
});
