import { beforeEach, describe, expect, test } from "vitest";
import { MonthlyExpenseService } from "~/modules/cash-flow/services/MonthlyExpenseService";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { orquestrator } from "~/tests/orquestrator";

describe("MonthlyExpenseService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("keeps payment status independent for every calendar month", async () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const service = new MonthlyExpenseService(orquestrator.database, () => now);
    const user = await orquestrator.createUser();
    const electricity = await service.createMonthlyExpense({
      idUser: user.id,
      name: "Electricity",
      expectedAmount: 150,
      dueDay: 15,
    });
    await service.createMonthlyExpense({
      idUser: user.id,
      name: "Rent",
      expectedAmount: 1800,
      dueDay: 5,
    });

    await service.setMonthlyExpensePaid(
      user.id,
      electricity.expense.id,
      true,
      "2026-07",
    );
    await service.setMonthlyExpensePaid(
      user.id,
      electricity.expense.id,
      true,
      "2026-07",
    );

    const july = await service.listMonthlyExpenses(user.id, "2026-07");
    const august = await service.listMonthlyExpenses(user.id, "2026-08");
    const paymentRows = await orquestrator.database.sql`
      SELECT * FROM monthly_expense_payments
      WHERE id_monthly_expense = ${electricity.expense.id}
    `;
    expect(july.map((item) => [item.expense.name, item.isPaid])).toEqual([
      ["Rent", false],
      ["Electricity", true],
    ]);
    expect(august.every((item) => !item.isPaid)).toBe(true);
    expect(paymentRows).toHaveLength(1);
  });

  test("updates optional details and archives without deleting payment history", async () => {
    const service = new MonthlyExpenseService(orquestrator.database);
    const user = await orquestrator.createUser();
    const created = await service.createMonthlyExpense({
      idUser: user.id,
      name: "Internet",
      expectedAmount: 120,
      dueDay: 8,
    });
    await service.setMonthlyExpensePaid(
      user.id,
      created.expense.id,
      true,
      "2026-07",
    );

    const updated = await service.updateMonthlyExpense({
      idUser: user.id,
      id: created.expense.id,
      name: "Home internet",
      clearExpectedAmount: true,
      clearDueDay: true,
    });
    expect(updated.expense).toMatchObject({ name: "Home internet" });
    expect(updated.expense.expectedAmount).toBeUndefined();
    expect(updated.expense.dueDay).toBeUndefined();

    await service.archiveMonthlyExpense(user.id, created.expense.id);

    expect(await service.listMonthlyExpenses(user.id)).toHaveLength(0);
    const paymentRows = await orquestrator.database.sql`
      SELECT * FROM monthly_expense_payments
      WHERE id_monthly_expense = ${created.expense.id}
    `;
    expect(paymentRows).toHaveLength(1);
  });

  test("scopes bills to their owner and uses Sao Paulo month boundaries", async () => {
    const service = new MonthlyExpenseService(
      orquestrator.database,
      () => new Date("2026-08-01T02:30:00.000Z"),
    );
    const user = await orquestrator.createUser();
    const otherUser = await orquestrator.createUser();
    const created = await service.createMonthlyExpense({
      idUser: user.id,
      name: "Rent",
    });

    expect(service.currentMonth()).toBe("2026-07");
    expect(await service.listMonthlyExpenses(otherUser.id)).toHaveLength(0);
    await expect(
      service.setMonthlyExpensePaid(otherUser.id, created.expense.id, true),
    ).rejects.toThrow(NotFoundException);
  });
});
