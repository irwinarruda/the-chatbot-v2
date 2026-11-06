import { describe, expect, test } from "vitest";
import { parseMonthlyExpense } from "~/client/modules/cash-flow/app/repositories/ApiMonthlyExpenseRepository";
import {
  CreateMonthlyExpenseRequestDTO,
  PayMonthlyExpenseRequestDTO,
  UpdateMonthlyExpenseRequestDTO,
} from "~/contracts/http/cash-flow/monthly-expense";
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
        category: "Utilities",
        defaultBankAccount: "Nubank",
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
      category: "Utilities",
      defaultBankAccount: "Nubank",
      isPaid: true,
      paidAt: "2026-07-10T12:00:00.000Z",
    });
    expect(parseMonthlyExpense(wireResponse)).toEqual(response);
  });

  test("accepts a bill category and default account on create and clears them with null on update", () => {
    expect(
      CreateMonthlyExpenseRequestDTO.parse({
        name: "Electricity",
        category: " Utilities ",
      }).category,
    ).toBe("Utilities");
    expect(
      UpdateMonthlyExpenseRequestDTO.parse({
        category: null,
        defaultBankAccount: null,
      }),
    ).toEqual({ category: null, defaultBankAccount: null });
    expect(
      CreateMonthlyExpenseRequestDTO.parse({
        name: "Electricity",
        defaultBankAccount: "Nubank",
      }).defaultBankAccount,
    ).toBe("Nubank");
    expect(
      CreateMonthlyExpenseRequestDTO.safeParse({
        name: "Electricity",
        category: " ",
      }).success,
    ).toBe(false);
  });

  test("rejects a payment whose category or account a bill could not store", () => {
    const payment = {
      month: "2026-09",
      bankAccount: "NuConta",
      category: "Internet",
      date: "2026-09-03",
    };
    expect(PayMonthlyExpenseRequestDTO.safeParse(payment).success).toBe(true);
    expect(
      PayMonthlyExpenseRequestDTO.safeParse({
        ...payment,
        category: "a".repeat(161),
      }).success,
    ).toBe(false);
    expect(
      PayMonthlyExpenseRequestDTO.safeParse({
        ...payment,
        bankAccount: "a".repeat(161),
      }).success,
    ).toBe(false);
  });
});
