import { ZodError, z } from "zod";
import type { CashFlowService } from "~/modules/cash-flow/application/CashFlowService";
import type {
  MonthlyExpenseItem,
  MonthlyExpenseService,
} from "~/modules/cash-flow/application/MonthlyExpenseService";
import { AddCashFlowSpreadsheetUrlToolDTO } from "~/modules/cash-flow/application/tools/AddCashFlowSpreadsheetUrlToolDTO";
import { AddTransactionToolDTO } from "~/modules/cash-flow/application/tools/AddTransactionToolDTO";
import { CreateMonthlyExpenseToolDTO } from "~/modules/cash-flow/application/tools/CreateMonthlyExpenseToolDTO";
import { GetBankAccountsStatusToolDTO } from "~/modules/cash-flow/application/tools/GetBankAccountsStatusToolDTO";
import { GetLatestTransactionsToolDTO } from "~/modules/cash-flow/application/tools/GetLatestTransactionsToolDTO";
import { ListMonthlyExpensesToolDTO } from "~/modules/cash-flow/application/tools/ListMonthlyExpensesToolDTO";
import { PhoneNumberToolDTO } from "~/modules/cash-flow/application/tools/PhoneNumberToolDTO";
import { SetMonthlyExpensePaidToolDTO } from "~/modules/cash-flow/application/tools/SetMonthlyExpensePaidToolDTO";
import { SyncBankAccountBalanceToolDTO } from "~/modules/cash-flow/application/tools/SyncBankAccountBalanceToolDTO";
import { TransferBetweenBankAccountsToolDTO } from "~/modules/cash-flow/application/tools/TransferBetweenBankAccountsToolDTO";
import type { IAiChatGateway } from "~/modules/chat/application/ports/IAiChatGateway";
import {
  type AiToolContext,
  type RegisteredTool,
  ToolExecutor,
} from "~/modules/chat/application/ToolExecutor";
import { PromptLoader, PromptLocale } from "~/modules/chat/server/PromptLoader";
import type { AuthService } from "~/modules/identity/application/AuthService";
import { DeleteUserByChatChannelAddressToolDTO } from "~/modules/identity/application/tools/DeleteUserByChatChannelAddressToolDTO";
import type { User } from "~/modules/identity/domain/User";
import { GetCurrentDateTimeToolDTO } from "~/modules/system/application/tools/GetCurrentDateTimeToolDTO";
import type { TodoService } from "~/modules/todos/application/TodoService";
import { CreateTodosToolDTO } from "~/modules/todos/application/tools/CreateTodosToolDTO";
import { ListTodosToolDTO } from "~/modules/todos/application/tools/ListTodosToolDTO";
import {
  AppError,
  UnauthorizedException,
} from "~/shared/errors/ApplicationErrors";
import { ValidationException } from "~/shared/errors/DomainErrors";
import { Printable } from "~/shared/http/utils/Printable";

const currentTimeZone = "America/Sao_Paulo";
const currentDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: currentTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export class AiToolService extends ToolExecutor {
  private authService: AuthService;
  private cashFlowService: CashFlowService;
  private monthlyExpenseService: MonthlyExpenseService;
  private todoService: TodoService;
  private aiChatGateway: IAiChatGateway;
  private now: () => Date;

  constructor(
    authService: AuthService,
    cashFlowService: CashFlowService,
    monthlyExpenseService: MonthlyExpenseService,
    todoService: TodoService,
    aiChatGateway: IAiChatGateway,
    now: () => Date = () => new Date(),
  ) {
    super();
    this.authService = authService;
    this.cashFlowService = cashFlowService;
    this.monthlyExpenseService = monthlyExpenseService;
    this.todoService = todoService;
    this.aiChatGateway = aiChatGateway;
    this.now = now;
    this.setTools(this.buildRegistry());
  }

  private async resolveUser(context: AiToolContext): Promise<User> {
    if (!context.chat.idUser) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    const user = await this.authService.getUserById(context.chat.idUser);
    if (!user) {
      throw new UnauthorizedException("Authenticated user was not found");
    }
    return user;
  }

  private requireCashFlowPhone(user: User): string {
    if (!user.phoneNumber) {
      throw new ValidationException(
        "User phone number is required for cash-flow tools",
        "Share your phone number before using spreadsheet-backed financial tools.",
      );
    }
    return user.phoneNumber;
  }

  private async classifyWithRetry(
    type: string,
    userMessage: string,
    value: number,
    categories: string[],
    bankAccounts: string[],
  ) {
    const schema = z
      .object({
        category: z
          .string()
          .refine((category) => categories.includes(category)),
        bank_account: z
          .string()
          .refine((account) => bankAccounts.includes(account)),
        description: z.string().trim().min(1),
      })
      .strict();
    return this.generateClassification(
      PromptLoader.getTransactionClassification(PromptLocale.PtBr),
      Printable.make({
        type,
        description: userMessage,
        value,
        categories,
        bankAccounts,
      }),
      schema,
      "Could not determine classification or bank account.",
    );
  }

  private async classifyTransferWithRetry(
    userMessage: string,
    value: number,
    bankAccounts: string[],
  ) {
    const schema = z
      .object({
        from: z.string().refine((account) => bankAccounts.includes(account)),
        to: z.string().refine((account) => bankAccounts.includes(account)),
        description: z.string().trim().min(1),
      })
      .strict()
      .refine((classification) => classification.from !== classification.to, {
        message: "Source and destination bank accounts must differ",
      });
    return this.generateClassification(
      PromptLoader.getTransferClassification(PromptLocale.PtBr),
      Printable.make({
        type: "Transfer",
        description: userMessage,
        value,
        bankAccounts,
      }),
      schema,
      "Could not determine transfer classification.",
    );
  }

  private async generateClassification<T>(
    prompt: string,
    payload: string,
    schema: z.ZodType<T>,
    failureMessage: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.aiChatGateway.generateText(prompt, payload);
        const json = response
          .replace(/^\s*```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "");
        return schema.parse(JSON.parse(json));
      } catch (ex) {
        const status =
          ex && typeof ex === "object" && "status" in ex
            ? Number(ex.status)
            : undefined;
        const retryable =
          ex instanceof SyntaxError ||
          ex instanceof ZodError ||
          status === 429 ||
          (status !== undefined && status >= 500) ||
          (ex instanceof AppError && ex.statusCode >= 500);
        if (!retryable || attempt === 2) {
          throw new ValidationException(failureMessage);
        }
      }
    }
    throw new ValidationException(failureMessage);
  }

  private parseDate(date?: string): Date | undefined {
    return date ? new Date(`${date}T12:00:00.000Z`) : undefined;
  }

  private buildRegistry(): RegisteredTool[] {
    return [
      {
        name: "get_current_datetime",
        description: [
          "Return the current date and time for the user's time zone.",
          "Call this first and wait for its result before interpreting a current or relative date or time.",
          "Use it for expressions such as today, tomorrow, next Friday, one month from now, or a date without a year.",
          "Do not use it when the user provides a complete absolute date.",
          "Returns { currentDate, currentDateTimeUtc, timeZone }.",
        ].join("\n"),
        inputSchema: GetCurrentDateTimeToolDTO,
        mutating: false,
        run: async (args) => {
          GetCurrentDateTimeToolDTO.parse(args);
          const now = this.now();
          return {
            currentDate: currentDateFormatter.format(now),
            currentDateTimeUtc: now.toISOString(),
            timeZone: currentTimeZone,
          };
        },
      },
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
          const user = await this.resolveUser(context);
          const item = await this.monthlyExpenseService.createMonthlyExpense({
            idUser: user.id,
            name: input.name,
            expectedAmount: input.expected_amount,
            dueDay: input.due_day,
          });
          return {
            message: "Monthly expense created",
            expense: this.serializeMonthlyExpense(item),
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
          const user = await this.resolveUser(context);
          const items = await this.monthlyExpenseService.listMonthlyExpenses(
            user.id,
            input.month,
          );
          const filtered = items.filter((item) => {
            if (!input.status || input.status === "All") return true;
            return input.status === "Paid" ? item.isPaid : !item.isPaid;
          });
          return {
            month: input.month ?? this.monthlyExpenseService.currentMonth(),
            count: filtered.length,
            expenses: filtered.map((item) =>
              this.serializeMonthlyExpense(item),
            ),
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
          const user = await this.resolveUser(context);
          const item = await this.monthlyExpenseService.setMonthlyExpensePaid(
            user.id,
            input.expense_id,
            input.is_paid,
            input.month,
          );
          return {
            message: input.is_paid
              ? "Monthly expense marked as paid"
              : "Monthly expense marked as unpaid",
            expense: this.serializeMonthlyExpense(item),
          };
        },
      },
      {
        name: "create_todos",
        description: [
          "Create one or more todos for the authenticated user.",
          "Use this when the user asks to remember, note, create a task, save something to do later, or when an audio transcription contains clear tasks.",
          "One message may contain multiple todos. Extract each actionable item.",
          "Prefer one call with multiple todo objects when there is more than one.",
          "Use a short, clear, action-oriented name.",
          "Add description only when important details would be lost from the name.",
          "Set dueDate only when the user explicitly gives or clearly implies a date.",
          "Do not create todos for casual conversation unless the intent to save an action is clear.",
          "Returns { message, todos }.",
        ].join("\n"),
        inputSchema: CreateTodosToolDTO,
        mutating: true,
        run: async (args, context) => {
          const input = CreateTodosToolDTO.parse(args);
          const user = await this.resolveUser(context);
          const created = await this.todoService.createTodos(
            input.todos.map((todo) => ({
              idUser: user.id,
              idSourceMessage: context.sourceMessage.id,
              name: todo.name,
              description: todo.description,
              dueDate: this.parseDate(todo.dueDate),
              status: todo.status,
            })),
          );
          return {
            message: "Todos created",
            todos: created.map((todo) => todo.toJSON()),
          };
        },
      },
      {
        name: "list_todos",
        description:
          "List todos for the user filtered by status. Returns { count, todos }.",
        inputSchema: ListTodosToolDTO,
        mutating: false,
        run: async (args, context) => {
          const input = ListTodosToolDTO.parse(args);
          const user = await this.resolveUser(context);
          const todos = await this.todoService.listTodos(user.id, {
            status: input.status,
          });
          return { count: todos.length, todos: todos.map((t) => t.toJSON()) };
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
          const user = await this.resolveUser(context);
          await this.cashFlowService.addSpreadsheetUrl(
            this.requireCashFlowPhone(user),
            input.url,
          );
          return { message: "Spreadsheet linked successfully" };
        },
      },
      {
        name: "get_latest_transactions",
        description: [
          "Get the most recent N transactions for the user.",
          "Use this for any recent-activity question; the bounded result keeps the response small.",
          "limit defaults to 10 and is capped at 50.",
          "Items are returned oldest-first within the result; the last item is the newest.",
          "Returns { count, transactions: [ { sheet_id, date, value, category, description, bank_account } ] }.",
        ].join("\n"),
        inputSchema: GetLatestTransactionsToolDTO,
        mutating: false,
        run: async (args, context) => {
          const input = GetLatestTransactionsToolDTO.parse(args);
          const user = await this.resolveUser(context);
          const transactions = await this.cashFlowService.getLatestTransactions(
            this.requireCashFlowPhone(user),
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
          const user = await this.resolveUser(context);
          const transaction = await this.cashFlowService.getLastTransaction(
            this.requireCashFlowPhone(user),
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
          const user = await this.resolveUser(context);
          await this.cashFlowService.deleteLastTransaction(
            this.requireCashFlowPhone(user),
          );
          return { message: "Last transaction deleted" };
        },
      },
      {
        name: "add_transaction",
        description: [
          "Append a transaction specifying its type. Category and bank_account are automatically resolved via classification using available categories and bank accounts.",
          "For an Expense, the result also includes unpaid_monthly_expenses for the current month.",
          "Compare the transaction description, user message, value, category, and bank account with those candidates.",
          "If exactly one is a plausible match, finish by calling reply_with_options to ask whether it should be marked paid. Do not mark it automatically.",
          "If several are plausible, ask the user to choose. If none plausibly match, do not mention the checklist.",
          "Returns { message, type, category, bank_account, description, date, value, unpaid_monthly_expenses }.",
        ].join("\n"),
        inputSchema: AddTransactionToolDTO,
        mutating: true,
        run: async (args, context) => {
          const input = AddTransactionToolDTO.parse(args);
          const user = await this.resolveUser(context);
          const phoneNumber = this.requireCashFlowPhone(user);
          const date = this.parseDate(input.date) ?? new Date();
          const [categories, bankAccounts] = await Promise.all([
            input.type === "Expense"
              ? this.cashFlowService.getExpenseCategories(phoneNumber)
              : this.cashFlowService.getEarningCategories(phoneNumber),
            this.cashFlowService.getBankAccount(phoneNumber),
          ]);
          const parsed = await this.classifyWithRetry(
            input.type,
            input.user_message,
            input.value,
            categories,
            bankAccounts,
          );
          const transaction = {
            phoneNumber,
            date,
            value: input.value,
            category: parsed.category,
            description: parsed.description,
            bankAccount: parsed.bank_account,
          };
          if (input.type === "Expense") {
            await this.cashFlowService.addExpense(transaction);
          } else {
            await this.cashFlowService.addEarning(transaction);
          }
          let unpaidMonthlyExpenses: MonthlyExpenseItem[] = [];
          if (input.type === "Expense") {
            const monthlyExpenses =
              await this.monthlyExpenseService.listMonthlyExpenses(user.id);
            unpaidMonthlyExpenses = monthlyExpenses.filter(
              (item) => !item.isPaid,
            );
          }
          return {
            message: "Transaction added",
            type: input.type,
            category: parsed.category,
            bankAccount: parsed.bank_account,
            description: parsed.description,
            date,
            value: input.value,
            unpaidMonthlyExpenses: unpaidMonthlyExpenses.map((item) =>
              this.serializeMonthlyExpense(item),
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
          const user = await this.resolveUser(context);
          const phoneNumber = this.requireCashFlowPhone(user);
          const date = this.parseDate(input.date) ?? new Date();
          const bankAccounts =
            await this.cashFlowService.getBankAccount(phoneNumber);
          const parsed = await this.classifyTransferWithRetry(
            input.user_message,
            input.value,
            bankAccounts,
          );
          const category =
            await this.cashFlowService.transferBetweenBankAccounts({
              phoneNumber,
              date,
              value: input.value,
              description: parsed.description,
              from: parsed.from,
              to: parsed.to,
            });
          return {
            message: "Transfer completed successfully",
            from: parsed.from,
            to: parsed.to,
            category,
            description: parsed.description,
            date,
            value: input.value,
          };
        },
      },
      {
        name: "get_expense_categories",
        description: "List expense categories. Returns { count, categories }.",
        inputSchema: PhoneNumberToolDTO,
        mutating: false,
        run: async (args, context) => {
          PhoneNumberToolDTO.parse(args);
          const user = await this.resolveUser(context);
          const categories = await this.cashFlowService.getExpenseCategories(
            this.requireCashFlowPhone(user),
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
          const user = await this.resolveUser(context);
          const categories = await this.cashFlowService.getEarningCategories(
            this.requireCashFlowPhone(user),
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
          const user = await this.resolveUser(context);
          const banks = await this.cashFlowService.getBankAccount(
            this.requireCashFlowPhone(user),
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
          const user = await this.resolveUser(context);
          const bankAccounts = await this.cashFlowService.getBankAccountsStatus(
            this.requireCashFlowPhone(user),
            this.parseDate(input.date),
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
          const user = await this.resolveUser(context);
          const phoneNumber = this.requireCashFlowPhone(user);
          const date = this.parseDate(input.date) ?? new Date();
          const { categories, bankAccounts } =
            await this.cashFlowService.getCategoriesAndBankAccounts(
              phoneNumber,
            );
          const parsed = await this.classifyWithRetry(
            "Earning",
            input.user_message,
            input.current_balance,
            categories,
            bankAccounts,
          );
          await this.cashFlowService.syncBankAccountBalance({
            phoneNumber,
            bankAccount: parsed.bank_account,
            currentBalance: input.current_balance,
            category: parsed.category,
            description: parsed.description,
            date,
          });
          return { message: "Bank account balance synced successfully" };
        },
      },
      {
        name: "delete_user_by_chat_channel_address",
        description:
          "Delete the current user and all related data. Returns { message }.",
        inputSchema: DeleteUserByChatChannelAddressToolDTO,
        mutating: true,
        run: async (args, context) => {
          DeleteUserByChatChannelAddressToolDTO.parse(args);
          const user = await this.resolveUser(context);
          await this.authService.deleteUserById(
            user.id,
            context.chat.getChannelAddress(),
          );
          return { message: "The account was deleted successfully" };
        },
      },
    ];
  }

  private serializeMonthlyExpense(
    item: Awaited<ReturnType<MonthlyExpenseService["createMonthlyExpense"]>>,
  ) {
    return {
      id: item.expense.id,
      name: item.expense.name,
      expectedAmount: item.expense.expectedAmount,
      dueDay: item.expense.dueDay,
      month: item.month,
      isPaid: item.isPaid,
      paidAt: item.paidAt?.toISOString(),
    };
  }
}
