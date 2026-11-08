import { AddCashFlowSpreadsheetUrlToolDTO } from "~/contracts/tools/cash-flow/add-cash-flow-spreadsheet-url";
import { AddTransactionToolDTO } from "~/contracts/tools/cash-flow/add-transaction";
import { CreateMonthlyExpenseToolDTO } from "~/contracts/tools/cash-flow/create-monthly-expense";
import { GetBankAccountsStatusToolDTO } from "~/contracts/tools/cash-flow/get-bank-accounts-status";
import { GetLatestTransactionsToolDTO } from "~/contracts/tools/cash-flow/get-latest-transactions";
import { ListMonthlyExpensesToolDTO } from "~/contracts/tools/cash-flow/list-monthly-expenses";
import { PhoneNumberToolDTO } from "~/contracts/tools/cash-flow/phone-number";
import { SetMonthlyExpensePaidToolDTO } from "~/contracts/tools/cash-flow/set-monthly-expense-paid";
import { SyncBankAccountBalanceToolDTO } from "~/contracts/tools/cash-flow/sync-bank-account-balance";
import { TransferBetweenBankAccountsToolDTO } from "~/contracts/tools/cash-flow/transfer-between-bank-accounts";
import type { MonthlyExpenseItemDTO } from "~/domain/cash-flow/monthly-expense-commands";
import type { User } from "~/domain/identity/user";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { CashFlowService } from "~/server/modules/cash-flow/services/cash-flow.service";
import type { MonthlyExpenseService } from "~/server/modules/cash-flow/services/monthly-expense.service";
import type { TransactionEntryService } from "~/server/modules/cash-flow/services/transaction-entry.service";
import {
  parseToolDate,
  type RegisteredTool,
  requireToolUser,
} from "~/server/modules/chat/services/tool-executor.service";
import type { AuthService } from "~/server/modules/identity/services/auth.service";

export function createCashFlowTools(
  auth: AuthService,
  cashFlowService: CashFlowService,
  monthlyExpenseService: MonthlyExpenseService,
  transactionEntries: TransactionEntryService,
): RegisteredTool[] {
  return [
    {
      name: "create_monthly_expense",
      description: [
        "Create one recurring monthly bill for the authenticated user.",
        "Use this when the user asks to register a fixed or recurring monthly obligation.",
        "The expected amount and due day are optional because bills may vary.",
        "Returns { message, expense }.",
      ].join("\n"),
      inputSchema: CreateMonthlyExpenseToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = CreateMonthlyExpenseToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const item = await monthlyExpenseService.createMonthlyExpense({
          idUser: user.id,
          name: input.name,
          expectedAmount: input.expected_amount,
          dueDay: input.due_day,
        });
        return {
          message: "Monthly expense created",
          expense: serializeMonthlyExpense(item),
        };
      },
    },
    {
      name: "list_monthly_expenses",
      description: [
        "List recurring monthly bills and their paid status for one calendar month.",
        "Use this before marking a bill when its ID is not already available in a recent tool result.",
        "Omit month for the current month. Filter by All, Paid, or Unpaid when useful.",
        "Returns { month, count, expenses }.",
      ].join("\n"),
      inputSchema: ListMonthlyExpensesToolDTO,
      mutating: false,
      run: async (args, context) => {
        const input = ListMonthlyExpensesToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const items = await monthlyExpenseService.listMonthlyExpenses(
          user.id,
          input.month,
        );
        const filtered = items.filter((item) => {
          if (!input.status || input.status === "All") return true;
          return input.status === "Paid" ? item.isPaid : !item.isPaid;
        });
        return {
          month: input.month ?? monthlyExpenseService.currentMonth(),
          count: filtered.length,
          expenses: filtered.map((item) => serializeMonthlyExpense(item)),
        };
      },
    },
    {
      name: "set_monthly_expense_paid",
      description: [
        "Mark one recurring bill as paid or unpaid for one calendar month.",
        "Use the exact expense ID returned by list_monthly_expenses or add_transaction.",
        "After an expense transaction suggests a possible bill match, call this only after the user explicitly confirms the match.",
        "Omit month for the current month. Returns { message, expense }.",
      ].join("\n"),
      inputSchema: SetMonthlyExpensePaidToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = SetMonthlyExpensePaidToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const item = await monthlyExpenseService.setMonthlyExpensePaid(
          user.id,
          input.expense_id,
          input.is_paid,
          input.month,
        );
        return {
          message: input.is_paid
            ? "Monthly expense marked as paid"
            : "Monthly expense marked as unpaid",
          expense: serializeMonthlyExpense(item),
        };
      },
    },
    {
      name: "add_cash_flow_spreadsheet_url",
      description:
        "Associate a Google financial planning spreadsheet with a user. Fails if user not found, already has a sheet, or URL invalid. Returns { message }.",
      inputSchema: AddCashFlowSpreadsheetUrlToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = AddCashFlowSpreadsheetUrlToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        await cashFlowService.addSpreadsheetUrl(
          requireCashFlowPhone(user),
          input.url,
        );
        return { message: "Spreadsheet linked successfully" };
      },
    },
    {
      name: "get_latest_transactions",
      description: [
        "Get transactions for the user.",
        "Omit limit to return the full spreadsheet history.",
        "Provide limit to return the most recent N transactions; there is no maximum.",
        "Items are returned oldest-first within the result; the last item is the newest.",
        "Returns { count, transactions: [ { sheet_id, date, value, category, description, bank_account } ] }.",
      ].join("\n"),
      inputSchema: GetLatestTransactionsToolDTO,
      mutating: false,
      run: async (args, context) => {
        const input = GetLatestTransactionsToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const transactions = await cashFlowService.getLatestTransactions(
          requireCashFlowPhone(user),
          input.limit,
        );
        return { count: transactions.length, transactions };
      },
    },
    {
      name: "get_last_transaction",
      description:
        "Get the most recently appended transaction. Returns { transaction? }.",
      inputSchema: PhoneNumberToolDTO,
      mutating: false,
      run: async (args, context) => {
        PhoneNumberToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const transaction = await cashFlowService.getLastTransaction(
          requireCashFlowPhone(user),
        );
        return transaction === undefined ? {} : { transaction };
      },
    },
    {
      name: "delete_last_transaction",
      description:
        "Delete the last (most recent) transaction. Returns { message }.",
      inputSchema: PhoneNumberToolDTO,
      mutating: true,
      run: async (args, context) => {
        PhoneNumberToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        await cashFlowService.deleteLastTransaction(requireCashFlowPhone(user));
        return { message: "Last transaction deleted" };
      },
    },
    {
      name: "add_transaction",
      description: [
        "Append a transaction specifying its type. Category and bank_account are automatically resolved via classification using available categories and bank accounts.",
        "For an Expense, the result also includes unpaid_monthly_expenses for the current month.",
        "Compare the transaction description, user message, value, category, and bank account with those candidates.",
        "If exactly one is a plausible match, call get_bank_accounts_status first, then finish by calling reply_with_options to ask whether it should be marked paid. Do not mark it automatically.",
        "If several are plausible, ask the user to choose. If none plausibly match, do not mention the checklist.",
        "Returns { message, type, category, bank_account, description, date, value, unpaid_monthly_expenses }.",
      ].join("\n"),
      inputSchema: AddTransactionToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = AddTransactionToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const entry = await transactionEntries.addTransaction({
          idUser: user.id,
          phoneNumber: requireCashFlowPhone(user),
          type: input.type,
          userMessage: input.user_message,
          value: input.value,
          date: parseToolDate(input.date) ?? new Date(),
          model: context.model,
        });
        return {
          message: "Transaction added",
          type: input.type,
          category: entry.category,
          bankAccount: entry.bankAccount,
          description: entry.description,
          date: entry.date,
          value: entry.value,
          unpaidMonthlyExpenses: entry.unpaidMonthlyExpenses.map((item) =>
            serializeMonthlyExpense(item),
          ),
        };
      },
    },
    {
      name: "transfer_between_bank_accounts",
      description:
        "Transfer a fixed amount from one bank account to another. Creates two entries: an expense on the source account and an earning on the destination account. Bank accounts are resolved via classification, while the transfer category is read from the spreadsheet. Use this for credit card payments or any movement of money between accounts. Returns { message, from, to, category, description, date, value }.",
      inputSchema: TransferBetweenBankAccountsToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = TransferBetweenBankAccountsToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const transfer = await transactionEntries.transfer({
          idUser: user.id,
          phoneNumber: requireCashFlowPhone(user),
          userMessage: input.user_message,
          value: input.value,
          date: parseToolDate(input.date) ?? new Date(),
          model: context.model,
        });
        return { message: "Transfer completed successfully", ...transfer };
      },
    },
    {
      name: "get_expense_categories",
      description: "List expense categories. Returns { count, categories }.",
      inputSchema: PhoneNumberToolDTO,
      mutating: false,
      run: async (args, context) => {
        PhoneNumberToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const categories = await cashFlowService.getExpenseCategories(
          requireCashFlowPhone(user),
        );
        return { count: categories.length, categories };
      },
    },
    {
      name: "get_earning_categories",
      description: "List earning categories. Returns { count, categories }.",
      inputSchema: PhoneNumberToolDTO,
      mutating: false,
      run: async (args, context) => {
        PhoneNumberToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const categories = await cashFlowService.getEarningCategories(
          requireCashFlowPhone(user),
        );
        return { count: categories.length, categories };
      },
    },
    {
      name: "get_bank_accounts",
      description:
        "List bank accounts referenced. Returns { count, bank_accounts }.",
      inputSchema: PhoneNumberToolDTO,
      mutating: false,
      run: async (args, context) => {
        PhoneNumberToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const banks = await cashFlowService.getBankAccount(
          requireCashFlowPhone(user),
        );
        return { count: banks.length, banks };
      },
    },
    {
      name: "get_bank_accounts_status",
      description:
        "List bank accounts with nonzero balances for a month. If date is omitted, uses the current date. Returns { count, bank_accounts: [ { bank_account, balance } ] }.",
      inputSchema: GetBankAccountsStatusToolDTO,
      mutating: false,
      run: async (args, context) => {
        const input = GetBankAccountsStatusToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        const bankAccounts = await cashFlowService.getBankAccountsStatus(
          requireCashFlowPhone(user),
          parseToolDate(input.date),
        );
        return { count: bankAccounts.length, bankAccounts };
      },
    },
    {
      name: "sync_bank_account_balance",
      description:
        "Reconcile a bank account's tracked balance with the real balance reported by the user. Automatically computes the difference and creates an earning (if money appeared, e.g. interest) or expense (if money disappeared) transaction to bring the spreadsheet in sync. Bank account, category, and description are automatically resolved via classification. Returns { message }.",
      inputSchema: SyncBankAccountBalanceToolDTO,
      mutating: true,
      run: async (args, context) => {
        const input = SyncBankAccountBalanceToolDTO.parse(args);
        const user = await requireToolUser(auth, context);
        await transactionEntries.syncBalance({
          idUser: user.id,
          phoneNumber: requireCashFlowPhone(user),
          userMessage: input.user_message,
          currentBalance: input.current_balance,
          date: parseToolDate(input.date) ?? new Date(),
          model: context.model,
        });
        return { message: "Bank account balance synced successfully" };
      },
    },
  ];
}

function requireCashFlowPhone(user: User): string {
  if (!user.phoneNumber) {
    throw new ValidationException(
      "User phone number is required for cash-flow tools",
      "Share your phone number before using spreadsheet-backed financial tools.",
    );
  }
  return user.phoneNumber;
}

function serializeMonthlyExpense(item: MonthlyExpenseItemDTO) {
  return {
    id: item.expense.id,
    name: item.expense.name,
    expectedAmount: item.expense.expectedAmount,
    dueDay: item.expense.dueDay,
    category: item.expense.category,
    defaultBankAccount: item.expense.defaultBankAccount,
    month: item.month,
    isPaid: item.isPaid,
    paidAt: item.paidAt?.toISOString(),
  };
}
