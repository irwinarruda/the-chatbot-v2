import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toCashFlowDashboardResponse } from "~/contracts/http/cash-flow/cash-flow-mapper";
import { User } from "~/domain/identity/user";
import { ValidationException } from "~/domain/shared/domain-errors";
import { TestCashFlowSpreadsheetGateway } from "~/server/modules/cash-flow/gateways/test.cash-flow-spreadsheet";
import { CashFlowSpreadsheetRepository } from "~/server/modules/cash-flow/repositories/cash-flow-spreadsheet.repository";
import { CashFlowService } from "~/server/modules/cash-flow/services/cash-flow.service";
import { MonthlyExpensePaymentService } from "~/server/modules/cash-flow/services/monthly-expense-payment.service";
import { NotFoundException } from "~/server/shared/errors/application-errors";
import { createAppGoogleLoginState } from "~/tests/support/create-app-google-login-state";
import { orquestrator } from "~/tests/support/orchestrator";

const phoneNumber = "5511999999999";
const date = new Date("2026-09-04T12:00:00.000Z");
const month = "2026-09";
const transfer = {
  id: "a5337eac-71f5-4cce-9a4e-f2e4a95d789f",
  phoneNumber,
  from: "NuConta",
  to: "Caju",
  value: 125.5,
  date,
  description: "",
};

let gateway: TestCashFlowSpreadsheetGateway;
let cashFlow: CashFlowService;
let bills: typeof orquestrator.monthlyExpenseService;
let payments: MonthlyExpensePaymentService;

async function setupUser() {
  const user = new User("Finance tester", phoneNumber);
  user.bsuid = phoneNumber;
  await orquestrator.authService.createUser(user);
  const state = await createAppGoogleLoginState(
    orquestrator.authService,
    phoneNumber,
  );
  await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
  await cashFlow.addSpreadsheetUrl(
    phoneNumber,
    `https://docs.google.com/spreadsheets/d/${orquestrator.googleSheetsConfig.testSheetId}/edit`,
  );
  return user;
}

async function setupBill() {
  const user = await setupUser();
  const bill = await bills.createMonthlyExpense({
    idUser: user.id,
    name: "Home internet",
    expectedAmount: 120.25,
    month,
  });
  const dto = {
    month,
    bankAccount: "NuConta",
    category: "Telefone, internet e TV",
    date: "2026-09-03",
  };
  return { user, bill, dto };
}

beforeEach(async () => {
  gateway = new TestCashFlowSpreadsheetGateway(orquestrator.googleSheetsConfig);
  cashFlow = new CashFlowService(
    new CashFlowSpreadsheetRepository(orquestrator.database),
    orquestrator.authService,
    gateway,
  );
  bills = orquestrator.monthlyExpenseService;
  payments = new MonthlyExpensePaymentService(bills, cashFlow);
  gateway.reset();
  await orquestrator.clearDatabase();
});
afterEach(() => {
  gateway.reset();
  vi.restoreAllMocks();
});

describe("Linked transfers", () => {
  test("creates once, edits both entries, and deletes the pair without changing net balance", async () => {
    await setupUser();
    await cashFlow.transferBetweenBankAccounts(transfer);
    await cashFlow.transferBetweenBankAccounts(transfer);
    let dashboard = await cashFlow.getDashboard(phoneNumber, date);
    expect(dashboard.transactions).toHaveLength(2);
    expect(dashboard.transactions.map((item) => item.value)).toEqual([
      -125.5, 125.5,
    ]);
    expect(
      dashboard.bankAccountStatuses.reduce(
        (total, item) => total + item.balance,
        0,
      ),
    ).toBe(0);
    expect(
      toCashFlowDashboardResponse(dashboard).transactions.every(
        (item) => item.transferId === transfer.id,
      ),
    ).toBe(true);

    await cashFlow.transferBetweenBankAccounts(
      {
        ...transfer,
        from: "Caju",
        to: "NuConta",
        value: 75,
        description: "Moved back",
        date: new Date("2026-09-02T12:00:00Z"),
      },
      true,
    );
    dashboard = await cashFlow.getDashboard(phoneNumber, date);
    expect(dashboard.transactions).toMatchObject([
      {
        transferId: transfer.id,
        value: -75,
        bankAccount: "Caju",
        description: "Moved back",
      },
      {
        transferId: transfer.id,
        value: 75,
        bankAccount: "NuConta",
        description: "Moved back",
      },
    ]);
    expect(
      dashboard.bankAccountStatuses.reduce(
        (total, item) => total + item.balance,
        0,
      ),
    ).toBe(0);
    await cashFlow.deleteLastTransaction(phoneNumber);
    expect(await cashFlow.getAllTransactions(phoneNumber)).toEqual([]);
    await cashFlow.deleteTransfer(phoneNumber, transfer.id);
  });

  test("rejects invalid transfers and edits of missing transfers without writes", async () => {
    await setupUser();
    for (const patch of [
      { to: "NuConta" },
      { to: "Missing" },
      { value: 0 },
      { value: Number.NaN },
      { date: new Date("invalid") },
    ]) {
      await expect(
        cashFlow.transferBetweenBankAccounts({ ...transfer, ...patch }),
      ).rejects.toThrow(ValidationException);
    }
    await expect(
      cashFlow.transferBetweenBankAccounts(transfer, true),
    ).rejects.toThrow(ValidationException);
    expect(await cashFlow.getAllTransactions(phoneNumber)).toEqual([]);
  });

  test("deletes an older transfer without touching an unrelated expense", async () => {
    await setupUser();
    await cashFlow.transferBetweenBankAccounts(transfer);
    await cashFlow.addExpense({
      phoneNumber,
      date,
      value: 20,
      category: "Delivery",
      description: "Lunch",
      bankAccount: "NuConta",
    });
    await cashFlow.deleteTransfer(phoneNumber, transfer.id);
    expect(await cashFlow.getAllTransactions(phoneNumber)).toMatchObject([
      { description: "Lunch", value: -20 },
    ]);
  });
});

describe("Monthly bill bank payments", () => {
  test("creates one expense for concurrent requests, keeps checkbox-only behavior, and isolates months", async () => {
    const { user, bill, dto } = await setupBill();
    await bills.setMonthlyExpensePaid(user.id, bill.expense.id, true, month);
    expect(await cashFlow.getAllTransactions(phoneNumber)).toHaveLength(0);
    await Promise.all(
      [1, 2, 3].map(() =>
        payments.payFromAccount(user.id, phoneNumber, bill.expense.id, dto),
      ),
    );
    expect(await cashFlow.getAllTransactions(phoneNumber)).toMatchObject([
      {
        description: "Home internet",
        value: -120.25,
        bankAccount: "NuConta",
        date: new Date("2026-09-03T12:00:00.000Z"),
      },
    ]);
    expect((await bills.listMonthlyExpenses(user.id, month))[0]).toMatchObject({
      isPaid: true,
      paidAt: new Date("2026-09-03T12:00:00.000Z"),
    });
    await bills.setMonthlyExpensePaid(user.id, bill.expense.id, false, month);
    await payments.payFromAccount(user.id, phoneNumber, bill.expense.id, dto);
    expect(await cashFlow.getAllTransactions(phoneNumber)).toHaveLength(1);
    await payments.payFromAccount(user.id, phoneNumber, bill.expense.id, {
      ...dto,
      month: "2026-10",
      date: "2026-10-03",
    });
    expect(await cashFlow.getAllTransactions(phoneNumber)).toHaveLength(2);
  });

  test("reconciles a provider success followed by a lost response without duplicating the expense", async () => {
    const { user, bill, dto } = await setupBill();
    const original = gateway.addBillPayment.bind(gateway);
    vi.spyOn(gateway, "addBillPayment").mockImplementationOnce(
      async (input) => {
        await original(input);
        throw new Error("Response lost after spreadsheet committed");
      },
    );
    await expect(
      payments.payFromAccount(user.id, phoneNumber, bill.expense.id, dto),
    ).rejects.toThrow("Response lost");
    expect((await bills.listMonthlyExpenses(user.id, month))[0].isPaid).toBe(
      false,
    );
    expect((await cashFlow.getAllTransactions(phoneNumber))[0]).toMatchObject({
      paymentId: `${bill.expense.id}:${month}`,
      bankAccount: "NuConta",
    });
    await payments.payFromAccount(user.id, phoneNumber, bill.expense.id, {
      ...dto,
      bankAccount: "Caju",
      date: "2026-09-04",
    });
    expect(await cashFlow.getAllTransactions(phoneNumber)).toHaveLength(1);
    expect((await bills.listMonthlyExpenses(user.id, month))[0]).toMatchObject({
      isPaid: true,
      paidAt: new Date("2026-09-03T12:00:00.000Z"),
    });
  });

  test("reuses the spreadsheet payment when marking the checklist fails", async () => {
    const { user, bill, dto } = await setupBill();
    vi.spyOn(bills, "setMonthlyExpensePaid").mockRejectedValueOnce(
      new Error("Database unavailable"),
    );
    await expect(
      payments.payFromAccount(user.id, phoneNumber, bill.expense.id, dto),
    ).rejects.toThrow("Database unavailable");
    await payments.payFromAccount(user.id, phoneNumber, bill.expense.id, dto);
    expect(await cashFlow.getAllTransactions(phoneNumber)).toHaveLength(1);
    expect((await bills.listMonthlyExpenses(user.id, month))[0].isPaid).toBe(
      true,
    );
  });

  test("saves the first payment's category and account to the bill and keeps them for later months", async () => {
    const { user, bill, dto } = await setupBill();
    expect(bill.expense.category).toBeUndefined();
    expect(bill.expense.bankAccount).toBeUndefined();

    const paid = await payments.payFromAccount(
      user.id,
      phoneNumber,
      bill.expense.id,
      dto,
    );

    expect(paid.expense).toMatchObject({
      category: "Telefone, internet e TV",
      bankAccount: "NuConta",
    });
    const [october] = await bills.listMonthlyExpenses(user.id, "2026-10");
    expect(october?.expense).toMatchObject({
      category: "Telefone, internet e TV",
      bankAccount: "NuConta",
    });
    expect((await cashFlow.getAllTransactions(phoneNumber))[0]).toMatchObject({
      category: "Telefone, internet e TV",
    });
  });

  test("keeps the default account when one payment uses another", async () => {
    const { user, bill, dto } = await setupBill();
    await bills.updateMonthlyExpense({
      idUser: user.id,
      id: bill.expense.id,
      bankAccount: "NuConta",
      month,
    });

    const paid = await payments.payFromAccount(
      user.id,
      phoneNumber,
      bill.expense.id,
      { ...dto, bankAccount: "Caju" },
    );

    expect(paid.expense.bankAccount).toBe("NuConta");
    expect((await cashFlow.getAllTransactions(phoneNumber))[0]).toMatchObject({
      bankAccount: "Caju",
    });
  });

  test("never saves a category the spreadsheet rejects", async () => {
    const { user, bill, dto } = await setupBill();
    await expect(
      payments.payFromAccount(user.id, phoneNumber, bill.expense.id, {
        ...dto,
        category: "Unknown",
      }),
    ).rejects.toThrow(ValidationException);
    const [september] = await bills.listMonthlyExpenses(user.id, month);
    expect(september?.expense.category).toBeUndefined();
    expect(await cashFlow.getAllTransactions(phoneNumber)).toHaveLength(0);
  });

  test("rejects another owner's bill, unknown accounts, and bills without an amount", async () => {
    const { user, bill, dto } = await setupBill();
    const other = await orquestrator.createUser();
    await expect(
      payments.payFromAccount(other.id, phoneNumber, bill.expense.id, dto),
    ).rejects.toThrow(NotFoundException);
    await expect(
      payments.payFromAccount(user.id, phoneNumber, bill.expense.id, {
        ...dto,
        bankAccount: "Unknown",
      }),
    ).rejects.toThrow(ValidationException);
    const variable = await bills.createMonthlyExpense({
      idUser: user.id,
      name: "Variable bill",
      month,
    });
    await expect(
      payments.payFromAccount(user.id, phoneNumber, variable.expense.id, dto),
    ).rejects.toThrow(ValidationException);
    expect(await cashFlow.getAllTransactions(phoneNumber)).toHaveLength(0);
  });
});
