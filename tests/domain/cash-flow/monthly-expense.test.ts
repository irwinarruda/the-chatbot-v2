import { describe, expect, test } from "vitest";
import { MonthlyExpense } from "~/domain/cash-flow/monthly-expense";
import { ValidationException } from "~/domain/shared/domain-errors";

describe("MonthlyExpense", () => {
  test("normalizes valid recurring bill details", () => {
    const expense = new MonthlyExpense({
      idUser: crypto.randomUUID(),
      name: "  Electricity bill  ",
      expectedAmount: 149.999,
      dueDay: 12,
      category: "  Utilities  ",
      bankAccount: " Nubank ",
    });

    expect(expense.name).toBe("Electricity bill");
    expect(expense.expectedAmount).toBe(150);
    expect(expense.dueDay).toBe(12);
    expect(expense.category).toBe("Utilities");
    expect(expense.bankAccount).toBe("Nubank");
  });

  test("rejects invalid names, amounts, due days, categories, and accounts", () => {
    const idUser = crypto.randomUUID();

    expect(() => new MonthlyExpense({ idUser, name: " " })).toThrow(
      ValidationException,
    );
    expect(
      () => new MonthlyExpense({ idUser, name: "Rent", expectedAmount: 0 }),
    ).toThrow(ValidationException);
    expect(
      () => new MonthlyExpense({ idUser, name: "Rent", dueDay: 32 }),
    ).toThrow(ValidationException);
    expect(
      () => new MonthlyExpense({ idUser, name: "Rent", category: " " }),
    ).toThrow(ValidationException);
    expect(
      () => new MonthlyExpense({ idUser, name: "Rent", bankAccount: "" }),
    ).toThrow(ValidationException);
  });

  test("updates and clears optional details", () => {
    const expense = new MonthlyExpense({
      idUser: crypto.randomUUID(),
      name: "Internet",
      expectedAmount: 100,
      dueDay: 10,
      category: "Utilities",
      bankAccount: "Nubank",
    });

    expense.rename("Home internet");
    expense.changeExpectedAmount(undefined);
    expense.changeDueDay(undefined);
    expense.changeCategory("Housing");
    expect(expense.category).toBe("Housing");
    expense.changeCategory(undefined);
    expense.changeBankAccount(undefined);

    expect(expense.name).toBe("Home internet");
    expect(expense.expectedAmount).toBeUndefined();
    expect(expense.dueDay).toBeUndefined();
    expect(expense.category).toBeUndefined();
    expect(expense.bankAccount).toBeUndefined();
  });
});
