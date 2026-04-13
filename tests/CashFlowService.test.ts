import { Encryption } from "~/infra/encryption";
import {
  NotFoundException,
  ServiceException,
  ValidationException,
} from "~/infra/exceptions";
import type { CashFlowAddExpenseDTO } from "~/server/services/CashFlowService";
import { User } from "~/shared/entities/User";
import { orquestrator } from "./orquestrator";

describe("CashFlowService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  async function createGoogleConnectedUser(phoneNumber: string) {
    await orquestrator.createUser({ phoneNumber });
    const encryption = new Encryption(orquestrator.encryptionConfig);
    await orquestrator.authService.handleGoogleRedirect(
      encryption.encrypt(phoneNumber),
      "rightCode",
    );
  }

  async function setupUserWithSpreadsheet(
    phoneNumber: string,
    sheetId = orquestrator.googleSheetsConfig.testSheetId,
  ) {
    await createGoogleConnectedUser(phoneNumber);
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit?gid=0#gid=0`;
    await orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, url);
  }

  async function withSpreadsheetCleanup<T>(
    phoneNumber: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const initialTransactionCount = (
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber)
    ).length;
    try {
      return await run();
    } finally {
      const currentTransactionCount = (
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber)
      ).length;
      const extraTransactions =
        currentTransactionCount - initialTransactionCount;

      for (let i = 0; i < extraTransactions; i++) {
        await orquestrator.cashFlowService.deleteLastTransaction(phoneNumber);
      }
    }
  }

  test("addSpreadsheetUrl should validate url parsing", async () => {
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
    const phoneNumber = "5511984444444";
    await setupUserWithSpreadsheet(phoneNumber);

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
    await setupUserWithSpreadsheet(phoneNumber);

    await withSpreadsheetCleanup(phoneNumber, async () => {
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
  });

  test("deleteLastTransaction should work", async () => {
    const phoneNumber = "5511984444444";
    await setupUserWithSpreadsheet(phoneNumber);

    await withSpreadsheetCleanup(phoneNumber, async () => {
      await orquestrator.cashFlowService.addExpense({
        phoneNumber,
        date: new Date(),
        value: 5.2,
        category: "Delivery",
        description: "DeleteMe",
        bankAccount: "NuConta",
      });

      await orquestrator.cashFlowService.deleteLastTransaction(phoneNumber);
      const lastTransaction =
        await orquestrator.cashFlowService.getLastTransaction(phoneNumber);
      expect(lastTransaction).toBeUndefined();
    });
  });

  test("getTransactions should work", async () => {
    const phoneNumber = "5511984444444";
    await setupUserWithSpreadsheet(phoneNumber);

    await withSpreadsheetCleanup(phoneNumber, async () => {
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
    });
  });

  test("getWrongSheetId should not work", async () => {
    const phoneNumber = "5511977777777";
    await createGoogleConnectedUser(phoneNumber);
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
    const okPhone = "5511966666666";
    await setupUserWithSpreadsheet(okPhone);

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
    const okPhone = "5511944444444";
    await setupUserWithSpreadsheet(okPhone);

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
    const okPhone = "5511922222222";
    await setupUserWithSpreadsheet(okPhone);

    const bankAccounts =
      await orquestrator.cashFlowService.getBankAccount(okPhone);
    expect(bankAccounts.length).toBeGreaterThan(0);

    const wrongPhone = "5511911111111";
    await setupUserWithSpreadsheet(wrongPhone, "WrongSheet");
    await expect(
      orquestrator.cashFlowService.getBankAccount(wrongPhone),
    ).rejects.toThrow(ServiceException);
  });

  test("addSpreadsheetUrl rejects missing users and duplicate sheets", async () => {
    await expect(
      orquestrator.cashFlowService.addSpreadsheetUrl(
        "5511900000000",
        "https://docs.google.com/spreadsheets/d/test-sheet/edit",
      ),
    ).rejects.toThrow(NotFoundException);

    const phoneNumber = "5511981111111";
    await setupUserWithSpreadsheet(
      phoneNumber,
      orquestrator.googleSheetsConfig.testSheetId,
    );

    await expect(
      orquestrator.cashFlowService.addSpreadsheetUrl(
        phoneNumber,
        "https://docs.google.com/spreadsheets/d/another-sheet/edit",
      ),
    ).rejects.toThrow(ValidationException);
  });

  test("addEarning and getCategoriesAndBankAccounts should work", async () => {
    const phoneNumber = "5511982222222";
    await setupUserWithSpreadsheet(phoneNumber);

    await withSpreadsheetCleanup(phoneNumber, async () => {
      await orquestrator.cashFlowService.addEarning({
        phoneNumber,
        date: new Date("2025-02-01"),
        value: -123.45,
        category: "Salário",
        description: "Pagamento",
        bankAccount: "Caju",
      });

      const lastTransaction =
        await orquestrator.cashFlowService.getLastTransaction(phoneNumber);
      expect(lastTransaction?.value).toBe(123.45);
      expect(lastTransaction?.category).toBe("Salário");

      const config =
        await orquestrator.cashFlowService.getCategoriesAndBankAccounts(
          phoneNumber,
        );
      expect(config.categories).toEqual(
        expect.arrayContaining([
          "Telefone, internet e TV",
          "Delivery",
          "Salário",
          "Outras Receitas",
        ]),
      );
      expect(config.bankAccounts).toEqual(
        expect.arrayContaining(["NuConta", "Caju"]),
      );
    });
  });

  test("cash flow operations validate missing google auth and missing spreadsheets", async () => {
    await expect(
      orquestrator.cashFlowService.getAllTransactions("5511900000001"),
    ).rejects.toThrow(NotFoundException);

    const noGooglePhone = "5511983333333";
    await orquestrator.createUser({ phoneNumber: noGooglePhone });
    await expect(
      orquestrator.cashFlowService.getExpenseCategories(noGooglePhone),
    ).rejects.toThrow(ValidationException);

    const phoneWithoutSheet = "5511984444000";
    await createGoogleConnectedUser(phoneWithoutSheet);

    await expect(
      orquestrator.cashFlowService.getBankAccount(phoneWithoutSheet),
    ).rejects.toThrow(ValidationException);
  });

  test("cash flow internal guards cover refresh and missing credential branches", async () => {
    const service = orquestrator.cashFlowService as unknown as {
      ensureSpreadsheetAccess: (user: User) => Promise<void>;
      getUserAndSheet: (phoneNumber: string) => Promise<unknown>;
      authService: {
        getUserByPhoneNumber: (
          phoneNumber: string,
        ) => Promise<User | undefined>;
        refreshGoogleCredential: (user: User) => Promise<void>;
      };
    };

    const expiringUser = new User("Irwin", "5511985555555");
    expiringUser.createGoogleCredential("access", "refresh", 3600);
    if (!expiringUser.googleCredential) {
      throw new Error("google credential should exist in test");
    }
    expiringUser.googleCredential.expirationDate = new Date(Date.now() - 1000);

    const refreshGoogleCredential = service.authService.refreshGoogleCredential;
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    service.authService.refreshGoogleCredential = refreshSpy;

    await service.ensureSpreadsheetAccess(expiringUser);
    expect(refreshSpy).toHaveBeenCalledWith(expiringUser);

    service.authService.refreshGoogleCredential = refreshGoogleCredential;

    const userWithoutCredential = new User("Irwin", "5511986666666");
    const getUserByPhoneNumber = service.authService.getUserByPhoneNumber;
    service.authService.getUserByPhoneNumber = vi
      .fn()
      .mockResolvedValue(userWithoutCredential);
    vi.spyOn(service, "ensureSpreadsheetAccess").mockResolvedValue(undefined);

    await expect(
      service.getUserAndSheet(userWithoutCredential.phoneNumber),
    ).rejects.toThrow("User is not connected to Google");

    service.authService.getUserByPhoneNumber = getUserByPhoneNumber;
  });
});
