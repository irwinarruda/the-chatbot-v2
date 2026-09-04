import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toCashFlowDashboardResponse } from "~/modules/cash-flow/contracts/CashFlowContractMapper";
import { TestCashFlowSpreadsheetGateway } from "~/modules/cash-flow/gateway/CashFlowSpreadsheetGateway/TestCashFlowSpreadsheetGateway";
import { CashFlowService } from "~/modules/cash-flow/services/CashFlowService";
import { MonthlyExpensePaymentService } from "~/modules/cash-flow/services/MonthlyExpensePaymentService";
import { User } from "~/modules/identity/entities/User";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { createAppGoogleLoginState } from "~/tests/createAppGoogleLoginState";
import { orquestrator } from "~/tests/orquestrator";

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
    orquestrator.database,
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
