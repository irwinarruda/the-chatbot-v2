import { Encryption } from "@infra/encryption";
import { ServiceException, ValidationException } from "@infra/exceptions";
import type { CashFlowAddExpenseDTO } from "~/services/CashFlowService";
import { orquestrator } from "./orquestrator";

describe("CashFlowService", () => {
  async function setupUserWithSpreadsheet(
    phoneNumber: string,
    sheetId: string,
  ) {
    const encryption = new Encryption(orquestrator.encryptionConfig);
    await orquestrator.authService.saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=0#gid=0`;
    await orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, url);
  }

  test("addSpreadsheetUrl should validate url parsing", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = "5511980000000";
    await orquestrator.createUser({ phoneNumber });

    await expect(() =>
      orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, "WrongURL"),
    ).rejects.toThrow();
    await expect(() =>
      orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, "http://"),
    ).rejects.toThrow();
    await expect(() =>
      orquestrator.cashFlowService.addSpreadsheetUrl(
        phoneNumber,
        "https://docs.google.com/spreadsheets/d",
      ),
    ).rejects.toThrow();
    await expect(() =>
      orquestrator.cashFlowService.addSpreadsheetUrl(
        phoneNumber,
        "https://docs.google.com/spreadsheets/d/",
      ),
    ).rejects.toThrow();

    const okUrl = `https://docs.google.com/spreadsheets/d/${orquestrator.googleSheetsConfig.testSheetId}/edit`;
    await orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, okUrl);
  });

  test("get and delete transaction should not work without data", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = "5511984444444";
    await setupUserWithSpreadsheet(
      phoneNumber,
      orquestrator.googleSheetsConfig.testSheetId,
    );

    const transactions =
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
    expect(transactions).toEqual([]);

    const transaction =
      await orquestrator.cashFlowService.getLastTransaction(phoneNumber);
    expect(transaction).toBeUndefined();

    await expect(
      orquestrator.cashFlowService.deleteLastTransaction(phoneNumber),
    ).rejects.toThrow(ValidationException);
  });

  test("addExpense should work", async () => {
    const phoneNumber = "5511984444444";

    const addExpense: CashFlowAddExpenseDTO = {
      phoneNumber,
      date: new Date(),
      value: 5.2,
      category: "Delivery",
      description: "UniqueExpense",
      bankAccount: "NuConta",
    };
    await orquestrator.cashFlowService.addExpense(addExpense);

    const lastTransaction =
      await orquestrator.cashFlowService.getLastTransaction(phoneNumber);
    expect(lastTransaction).toBeDefined();
    const txDate = new Date(addExpense.date.toDateString());
    expect(lastTransaction?.date.getTime()).toBe(txDate.getTime());
    expect(lastTransaction?.value).toBe(-addExpense.value);
    expect(lastTransaction?.description).toBe(addExpense.description);
    expect(lastTransaction?.category).toBe(addExpense.category);
    expect(lastTransaction?.bankAccount).toBe(addExpense.bankAccount);
  });

  test("deleteLastTransaction should work", async () => {
    const phoneNumber = "5511984444444";
    await orquestrator.cashFlowService.deleteLastTransaction(phoneNumber);
    const lastTransaction =
      await orquestrator.cashFlowService.getLastTransaction(phoneNumber);
    expect(lastTransaction).toBeUndefined();
  });

  test("getTransactions should work", async () => {
    const phoneNumber = "5511984444444";

    const expenseCategories =
      await orquestrator.cashFlowService.getExpenseCategories(phoneNumber);
    const bankAccounts =
      await orquestrator.cashFlowService.getBankAccount(phoneNumber);

    const newTransactions: CashFlowAddExpenseDTO[] = [
      {
        phoneNumber,
        date: new Date("2025-01-01"),
        value: 1000,
        category: "Supermercado",
        description: "Compras do mês",
        bankAccount: "NuConta",
      },
      {
        phoneNumber,
        date: new Date("2025-01-01"),
        value: 600,
        category: "Seguro do carro",
        description: "Seguro do meu carro",
        bankAccount: "NuConta",
      },
    ];

    for (const tx of newTransactions) {
      await orquestrator.cashFlowService.addExpense(tx);
    }

    const transactions =
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
    expect(transactions.length).toBe(2);
    expect(transactions).not.toEqual([]);

    for (const transaction of transactions) {
      expect(transaction.sheetId).toBe(
        orquestrator.googleSheetsConfig.testSheetId,
      );
      const isCategoryValid =
        expenseCategories.includes(transaction.category) ||
        bankAccounts.includes(transaction.bankAccount);
      expect(isCategoryValid).toBe(true);
    }

    for (let i = 0; i < newTransactions.length; i++) {
      await orquestrator.cashFlowService.deleteLastTransaction(phoneNumber);
    }
  });

  test("getWrongSheetId should not work", async () => {
    await orquestrator.clearDatabase();
    const phoneNumber = "5511977777777";
    const encryption = new Encryption(orquestrator.encryptionConfig);
    await orquestrator.authService.saveUserByGoogleCredential(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
    const wrongUrl =
      "https://docs.google.com/spreadsheets/d/WrongSheet/edit?gid=0#gid=0";
    await orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, wrongUrl);

    await expect(
      orquestrator.cashFlowService.getAllTransactions(phoneNumber),
    ).rejects.toThrow(ServiceException);
    await expect(
      orquestrator.cashFlowService.deleteLastTransaction(phoneNumber),
    ).rejects.toThrow(ServiceException);
    await expect(
      orquestrator.cashFlowService.addExpense({
        phoneNumber,
        date: new Date(),
        value: 1,
        category: "Any",
        description: "Any",
        bankAccount: "Any",
      }),
    ).rejects.toThrow(ServiceException);
  });

  test("getExpenseCategories should work", async () => {
    await orquestrator.clearDatabase();
    const okPhone = "5511966666666";
    await setupUserWithSpreadsheet(
      okPhone,
      orquestrator.googleSheetsConfig.testSheetId,
    );

    const expenseCategories =
      await orquestrator.cashFlowService.getExpenseCategories(okPhone);
    expect(expenseCategories.length).toBeGreaterThan(0);

    const wrongPhone = "5511955555555";
    await setupUserWithSpreadsheet(wrongPhone, "WrongSheet");
    await expect(
      orquestrator.cashFlowService.getExpenseCategories(wrongPhone),
    ).rejects.toThrow(ServiceException);
  });

  test("getEarningCategories should work", async () => {
    await orquestrator.clearDatabase();
    const okPhone = "5511944444444";
    await setupUserWithSpreadsheet(
      okPhone,
      orquestrator.googleSheetsConfig.testSheetId,
    );

    const earningCategories =
      await orquestrator.cashFlowService.getEarningCategories(okPhone);
    expect(earningCategories.length).toBeGreaterThan(0);

    const wrongPhone = "5511933333333";
    await setupUserWithSpreadsheet(wrongPhone, "WrongSheet");
    await expect(
      orquestrator.cashFlowService.getEarningCategories(wrongPhone),
    ).rejects.toThrow(ServiceException);
  });

  test("getBankAccount should work", async () => {
    await orquestrator.clearDatabase();
    const okPhone = "5511922222222";
    await setupUserWithSpreadsheet(
      okPhone,
      orquestrator.googleSheetsConfig.testSheetId,
    );

    const bankAccounts =
      await orquestrator.cashFlowService.getBankAccount(okPhone);
    expect(bankAccounts.length).toBeGreaterThan(0);

    const wrongPhone = "5511911111111";
    await setupUserWithSpreadsheet(wrongPhone, "WrongSheet");
    await expect(
      orquestrator.cashFlowService.getBankAccount(wrongPhone),
    ).rejects.toThrow(ServiceException);
  });
});
