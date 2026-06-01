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
    const user = new User("Test User", phoneNumber);
    user.bsuid = phoneNumber;
    await orquestrator.authService.createUser(user);
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

  async function clearSpreadsheetTransactions(phoneNumber: string) {
    let transactionCount = (
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber)
    ).length;
    let attempt = 0;
    while (transactionCount > 0) {
      if (attempt > 100) {
        throw new Error("Could not clear spreadsheet transactions");
      }
      await orquestrator.cashFlowService.deleteLastTransaction(phoneNumber);
      transactionCount = (
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber)
      ).length;
      attempt++;
    }
  }

  async function withEmptySpreadsheet<T>(
    phoneNumber: string,
    run: () => Promise<T>,
  ): Promise<T> {
    await clearSpreadsheetTransactions(phoneNumber);
    expect(
      await orquestrator.cashFlowService.getAllTransactions(phoneNumber),
    ).toEqual([]);
    try {
      return await run();
    } finally {
      await clearSpreadsheetTransactions(phoneNumber);
      expect(
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber),
      ).toEqual([]);
    }
  }

  async function getBankAccountsStatusEventually(
    phoneNumber: string,
    date: Date,
    expected: { bankAccount: string; balance: number }[],
  ) {
    let status = await orquestrator.cashFlowService.getBankAccountsStatus(
      phoneNumber,
      date,
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      if (
        status.length === expected.length &&
        status.every(
          (item, index) =>
            item.bankAccount === expected[index].bankAccount &&
            Math.abs(item.balance - expected[index].balance) < 0.001,
        )
      ) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      status = await orquestrator.cashFlowService.getBankAccountsStatus(
        phoneNumber,
        date,
      );
    }
    return status;
  }

  function expectBankAccountsStatusToEqual(
    actual: { bankAccount: string; balance: number }[],
    expected: { bankAccount: string; balance: number }[],
  ) {
    expect(actual.map((item) => item.bankAccount)).toEqual(
      expected.map((item) => item.bankAccount),
    );
    for (const [index, expectedItem] of expected.entries()) {
      expect(actual[index].balance).toBeCloseTo(expectedItem.balance);
    }
  }

  test("addSpreadsheetUrl should validate url parsing", async () => {
    const phoneNumber = "5511980000000";
    await orquestrator.createUser({ phoneNumber });

    await expect(
      orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, "WrongURL"),
    ).rejects.toThrow();
    await expect(
      orquestrator.cashFlowService.addSpreadsheetUrl(phoneNumber, "http://"),
    ).rejects.toThrow();
    await expect(
      orquestrator.cashFlowService.addSpreadsheetUrl(
        phoneNumber,
        "https://docs.google.com/spreadsheets/d",
      ),
    ).rejects.toThrow();
    await expect(
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
    await expect(
      orquestrator.cashFlowService.getBankAccountsStatus(phoneNumber),
    ).rejects.toThrow(ServiceException);
  });

  test("getExpenseCategories should work", async () => {
    const okPhone = "5511966666666";
    await setupUserWithSpreadsheet(okPhone);

    const expenseCategories =
      await orquestrator.cashFlowService.getExpenseCategories(okPhone);
    expect(expenseCategories.length).toBeGreaterThan(0);
  });

  test("getExpenseCategories rejects wrong spreadsheet", async () => {
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
  });

  test("getEarningCategories rejects wrong spreadsheet", async () => {
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
  });

  test("getBankAccount rejects wrong spreadsheet", async () => {
    const wrongPhone = "5511911111111";
    await setupUserWithSpreadsheet(wrongPhone, "WrongSheet");
    await expect(
      orquestrator.cashFlowService.getBankAccount(wrongPhone),
    ).rejects.toThrow(ServiceException);
  });

  test("getBankAccountsStatus should work from an empty spreadsheet", async () => {
    const phoneNumber = "5511923333333";
    await setupUserWithSpreadsheet(phoneNumber);

    await withEmptySpreadsheet(phoneNumber, async () => {
      await orquestrator.cashFlowService.addEarning({
        phoneNumber,
        date: new Date(2025, 10, 15),
        value: 300,
        category: "Salário",
        description: "Banco Inter balance",
        bankAccount: "Banco Inter",
      });
      await orquestrator.cashFlowService.addExpense({
        phoneNumber,
        date: new Date(2025, 10, 15),
        value: 42.28,
        category: "Delivery",
        description: "NuConta balance",
        bankAccount: "NuConta",
      });
      await orquestrator.cashFlowService.addEarning({
        phoneNumber,
        date: new Date(2025, 10, 15),
        value: 10,
        category: "Outras Receitas",
        description: "Caju balance in",
        bankAccount: "Caju",
      });
      await orquestrator.cashFlowService.addExpense({
        phoneNumber,
        date: new Date(2025, 10, 15),
        value: 10,
        category: "Delivery",
        description: "Caju balance out",
        bankAccount: "Caju",
      });
      await orquestrator.cashFlowService.addEarning({
        phoneNumber,
        date: new Date(2025, 11, 15),
        value: 90,
        category: "Salário",
        description: "December balance",
        bankAccount: "Banco Inter",
      });

      const expectedNovemberStatus = [
        { bankAccount: "Banco Inter", balance: 300 },
        { bankAccount: "NuConta", balance: -42.28 },
      ];
      const novemberStatus = await getBankAccountsStatusEventually(
        phoneNumber,
        new Date(2025, 10, 15),
        expectedNovemberStatus,
      );
      expectBankAccountsStatusToEqual(novemberStatus, expectedNovemberStatus);

      const expectedDecemberStatus = [
        { bankAccount: "Banco Inter", balance: 390 },
        { bankAccount: "NuConta", balance: -42.28 },
      ];
      const decemberStatus = await getBankAccountsStatusEventually(
        phoneNumber,
        new Date(2025, 11, 15),
        expectedDecemberStatus,
      );
      expectBankAccountsStatusToEqual(decemberStatus, expectedDecemberStatus);

      const januaryStatus = await getBankAccountsStatusEventually(
        phoneNumber,
        new Date(2025, 0, 15),
        [],
      );
      expect(januaryStatus).toEqual([]);
    });
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
    await expect(
      orquestrator.cashFlowService.getBankAccountsStatus(phoneWithoutSheet),
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

    await expect(service.getUserAndSheet("5511986666666")).rejects.toThrow(
      "User is not connected to Google",
    );

    service.authService.getUserByPhoneNumber = getUserByPhoneNumber;
  });

  test("syncBankAccountBalance should handle all sync scenarios", async () => {
    const phoneNumber = "5511924444444";
    await setupUserWithSpreadsheet(phoneNumber);

    await withEmptySpreadsheet(phoneNumber, async () => {
      const date = new Date(2025, 10, 15);

      // Setup: add initial earning of 100 to NuConta
      await orquestrator.cashFlowService.addEarning({
        phoneNumber,
        date,
        value: 100,
        category: "Salário",
        description: "Initial balance",
        bankAccount: "NuConta",
      });

      await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 100 },
      ]);

      // Scenario 1: earning adjustment (real balance higher)
      await orquestrator.cashFlowService.syncBankAccountBalance({
        phoneNumber,
        bankAccount: "NuConta",
        currentBalance: 150,
        category: "Outras Receitas",
        description: "Rendimento NuConta",
        date,
      });

      let status = await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 150 },
      ]);
      expectBankAccountsStatusToEqual(status, [
        { bankAccount: "NuConta", balance: 150 },
      ]);

      // Scenario 2: expense adjustment (real balance lower)
      await orquestrator.cashFlowService.syncBankAccountBalance({
        phoneNumber,
        bankAccount: "NuConta",
        currentBalance: 120,
        category: "Outros",
        description: "Ajuste de saldo",
        date,
      });

      status = await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 120 },
      ]);
      expectBankAccountsStatusToEqual(status, [
        { bankAccount: "NuConta", balance: 120 },
      ]);

      // Scenario 3: already in sync → should throw
      const transactionsBefore =
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber);

      await expect(
        orquestrator.cashFlowService.syncBankAccountBalance({
          phoneNumber,
          bankAccount: "NuConta",
          currentBalance: 120,
          category: "Outras Receitas",
          description: "Ajuste",
          date,
        }),
      ).rejects.toThrow(ValidationException);

      const transactionsAfter =
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
      expect(transactionsAfter.length).toBe(transactionsBefore.length);

      // Scenario 4: bank account not found → should throw
      await expect(
        orquestrator.cashFlowService.syncBankAccountBalance({
          phoneNumber,
          bankAccount: "NonExistentAccount",
          currentBalance: 50,
          category: "Outros",
          description: "Ajuste",
          date,
        }),
      ).rejects.toThrow(ValidationException);
    });
  });

  test("transferBetweenBankAccounts should create expense and earning entries", async () => {
    const phoneNumber = "5511910000001";
    await setupUserWithSpreadsheet(phoneNumber);
    await withEmptySpreadsheet(phoneNumber, async () => {
      const date = new Date(2025, 10, 15);
      await orquestrator.cashFlowService.addEarning({
        phoneNumber,
        date,
        value: 1000,
        category: "Salário",
        description: "Initial NuConta balance",
        bankAccount: "NuConta",
      });
      await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 1000 },
      ]);
      await orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date,
        value: 500,
        category: "Cartão de Crédito",
        description: "Pagamento cartão Nubank",
        from: "NuConta",
        to: "Caju",
      });
      const status = await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 500 },
        { bankAccount: "Caju", balance: 500 },
      ]);
      expectBankAccountsStatusToEqual(status, [
        { bankAccount: "NuConta", balance: 500 },
        { bankAccount: "Caju", balance: 500 },
      ]);
      const transactions =
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
      expect(transactions.length).toBe(3);
      const lastTwo = transactions.slice(-2);
      expect(lastTwo[0].value).toBe(-500);
      expect(lastTwo[0].bankAccount).toBe("NuConta");
      expect(lastTwo[1].value).toBe(500);
      expect(lastTwo[1].bankAccount).toBe("Caju");
    });
  });

  test("transferBetweenBankAccounts should reject non-existent source account", async () => {
    const phoneNumber = "5511910000002";
    await setupUserWithSpreadsheet(phoneNumber);
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date: new Date(),
        value: 100,
        category: "Transferência",
        description: "Test transfer",
        from: "NonExistentAccount",
        to: "NuConta",
      }),
    ).rejects.toThrow(ValidationException);
  });

  test("transferBetweenBankAccounts should reject non-existent destination account", async () => {
    const phoneNumber = "5511910000003";
    await setupUserWithSpreadsheet(phoneNumber);
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date: new Date(),
        value: 100,
        category: "Transferência",
        description: "Test transfer",
        from: "NuConta",
        to: "NonExistentAccount",
      }),
    ).rejects.toThrow(ValidationException);
  });

  test("transferBetweenBankAccounts should reject same source and destination", async () => {
    const phoneNumber = "5511910000004";
    await setupUserWithSpreadsheet(phoneNumber);
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date: new Date(),
        value: 100,
        category: "Transferência",
        description: "Same account transfer",
        from: "NuConta",
        to: "NuConta",
      }),
    ).rejects.toThrow(ValidationException);
  });

  test("transferBetweenBankAccounts should reject zero or negative value", async () => {
    const phoneNumber = "5511910000005";
    await setupUserWithSpreadsheet(phoneNumber);
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date: new Date(),
        value: 0,
        category: "Transferência",
        description: "Zero transfer",
        from: "NuConta",
        to: "Caju",
      }),
    ).rejects.toThrow(ValidationException);
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date: new Date(),
        value: -50,
        category: "Transferência",
        description: "Negative transfer",
        from: "NuConta",
        to: "Caju",
      }),
    ).rejects.toThrow(ValidationException);
  });

  test("transferBetweenBankAccounts should validate user and spreadsheet existence", async () => {
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber: "5511900099999",
        date: new Date(),
        value: 100,
        category: "Transferência",
        description: "Test",
        from: "NuConta",
        to: "Caju",
      }),
    ).rejects.toThrow(NotFoundException);
    const noGooglePhone = "5511910000006";
    await orquestrator.createUser({ phoneNumber: noGooglePhone });
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber: noGooglePhone,
        date: new Date(),
        value: 100,
        category: "Transferência",
        description: "Test",
        from: "NuConta",
        to: "Caju",
      }),
    ).rejects.toThrow(ValidationException);
    const noSheetPhone = "5511910000007";
    await createGoogleConnectedUser(noSheetPhone);
    await expect(
      orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber: noSheetPhone,
        date: new Date(),
        value: 100,
        category: "Transferência",
        description: "Test",
        from: "NuConta",
        to: "Caju",
      }),
    ).rejects.toThrow(ValidationException);
  });

  test("transferBetweenBankAccounts should accumulate multiple transfers correctly", async () => {
    const phoneNumber = "5511910000008";
    await setupUserWithSpreadsheet(phoneNumber);
    await withEmptySpreadsheet(phoneNumber, async () => {
      const date = new Date(2025, 10, 15);
      await orquestrator.cashFlowService.addEarning({
        phoneNumber,
        date,
        value: 1000,
        category: "Salário",
        description: "Initial balance",
        bankAccount: "NuConta",
      });
      await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 1000 },
      ]);
      await orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date,
        value: 200,
        category: "Transferência",
        description: "First transfer",
        from: "NuConta",
        to: "Caju",
      });
      let status = await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 800 },
        { bankAccount: "Caju", balance: 200 },
      ]);
      expectBankAccountsStatusToEqual(status, [
        { bankAccount: "NuConta", balance: 800 },
        { bankAccount: "Caju", balance: 200 },
      ]);
      await orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date,
        value: 300,
        category: "Transferência",
        description: "Second transfer",
        from: "NuConta",
        to: "Caju",
      });
      status = await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 500 },
        { bankAccount: "Caju", balance: 500 },
      ]);
      expectBankAccountsStatusToEqual(status, [
        { bankAccount: "NuConta", balance: 500 },
        { bankAccount: "Caju", balance: 500 },
      ]);
      await orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date,
        value: 100,
        category: "Transferência",
        description: "Reverse transfer",
        from: "Caju",
        to: "NuConta",
      });
      status = await getBankAccountsStatusEventually(phoneNumber, date, [
        { bankAccount: "NuConta", balance: 600 },
        { bankAccount: "Caju", balance: 400 },
      ]);
      expectBankAccountsStatusToEqual(status, [
        { bankAccount: "NuConta", balance: 600 },
        { bankAccount: "Caju", balance: 400 },
      ]);
    });
  });

  test("transferBetweenBankAccounts should preserve metadata on both entries", async () => {
    const phoneNumber = "5511910000009";
    await setupUserWithSpreadsheet(phoneNumber);
    await withEmptySpreadsheet(phoneNumber, async () => {
      const date = new Date(2025, 11, 15);
      await orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date,
        value: 750.5,
        category: "Cartão de Crédito",
        description: "Pagamento fatura Nubank dezembro",
        from: "NuConta",
        to: "Caju",
      });
      const transactions =
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
      expect(transactions.length).toBe(2);
      const expense = transactions[0];
      expect(expense.value).toBe(-750.5);
      expect(expense.category).toBe("Cartão de Crédito");
      expect(expense.description).toBe("Pagamento fatura Nubank dezembro");
      expect(expense.bankAccount).toBe("NuConta");
      expect(expense.date.getTime()).toBe(
        new Date(date.toDateString()).getTime(),
      );
      const earning = transactions[1];
      expect(earning.value).toBe(750.5);
      expect(earning.category).toBe("Cartão de Crédito");
      expect(earning.description).toBe("Pagamento fatura Nubank dezembro");
      expect(earning.bankAccount).toBe("Caju");
      expect(earning.date.getTime()).toBe(
        new Date(date.toDateString()).getTime(),
      );
    });
  });

  test("transferBetweenBankAccounts should handle decimal amounts", async () => {
    const phoneNumber = "5511910000010";
    await setupUserWithSpreadsheet(phoneNumber);
    await withEmptySpreadsheet(phoneNumber, async () => {
      await orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date: new Date(2025, 10, 15),
        value: 1234.56,
        category: "Cartão de Crédito",
        description: "Decimal transfer",
        from: "NuConta",
        to: "Caju",
      });
      const transactions =
        await orquestrator.cashFlowService.getAllTransactions(phoneNumber);
      expect(transactions.length).toBe(2);
      expect(transactions[0].value).toBeCloseTo(-1234.56);
      expect(transactions[1].value).toBeCloseTo(1234.56);
    });
  });

  test("transferBetweenBankAccounts should apply correct date to both entries", async () => {
    const phoneNumber = "5511910000011";
    await setupUserWithSpreadsheet(phoneNumber);
    await withEmptySpreadsheet(phoneNumber, async () => {
      const transferDate = new Date(2025, 10, 20);
      await orquestrator.cashFlowService.transferBetweenBankAccounts({
        phoneNumber,
        date: transferDate,
        value: 300,
        category: "Transferência",
        description: "November transfer",
        from: "NuConta",
        to: "Caju",
      });
      const novemberStatus = await getBankAccountsStatusEventually(
        phoneNumber,
        new Date(2025, 10, 20),
        [
          { bankAccount: "NuConta", balance: -300 },
          { bankAccount: "Caju", balance: 300 },
        ],
      );
      expectBankAccountsStatusToEqual(novemberStatus, [
        { bankAccount: "NuConta", balance: -300 },
        { bankAccount: "Caju", balance: 300 },
      ]);
      const decemberStatus =
        await orquestrator.cashFlowService.getBankAccountsStatus(
          phoneNumber,
          new Date(2025, 11, 20),
        );
      expect(decemberStatus).toEqual([
        { bankAccount: "NuConta", balance: -300 },
        { bankAccount: "Caju", balance: 300 },
      ]);
    });
  });
});
