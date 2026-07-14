import { describe, expect, test } from "vitest";
import { MonthlyExpense } from "~/modules/cash-flow/domain/MonthlyExpense";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("MonthlyExpense", () => {
  test("normalizes valid recurring bill details", () => {
    const expense = new MonthlyExpense({
      idUser: crypto.randomUUID(),
      name: "  Electricity bill  ",
      expectedAmount: 149.999,
      dueDay: 12,
    });

    expect(expense.name).toBe("Electricity bill");
    expect(expense.expectedAmount).toBe(150);
    expect(expense.dueDay).toBe(12);
  });

  test("rejects invalid names, amounts, and due days", () => {
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
  });

  test("updates and clears optional details", () => {
    const expense = new MonthlyExpense({
      idUser: crypto.randomUUID(),
      name: "Internet",
      expectedAmount: 100,
      dueDay: 10,
    });

    expense.rename("Home internet");
    expense.changeExpectedAmount(undefined);
    expense.changeDueDay(undefined);

    expect(expense.name).toBe("Home internet");
    expect(expense.expectedAmount).toBeUndefined();
    expect(expense.dueDay).toBeUndefined();
  });
});
