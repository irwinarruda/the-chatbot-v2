import { ZodError, z } from "zod";
import {
  AppError,
  UnauthorizedException,
  ValidationException,
} from "~/infra/exceptions";
import type {
  AiToolDefinition,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import type { AuthService } from "~/server/services/AuthService";
import type { CashFlowService } from "~/server/services/CashFlowService";
import type { TodoService } from "~/server/services/TodoService";
import { Printable } from "~/server/utils/Printable";
import { PromptLoader, PromptLocale } from "~/server/utils/PromptLoader";
import type { Chat } from "~/shared/entities/Chat";
import { AddCashFlowSpreadsheetUrlToolDTO } from "~/shared/entities/dtos/AddCashFlowSpreadsheetUrlToolDTO";
import { AddTransactionToolDTO } from "~/shared/entities/dtos/AddTransactionToolDTO";
import { CreateTodosToolDTO } from "~/shared/entities/dtos/CreateTodosToolDTO";
import { DeleteUserByChatChannelAddressToolDTO } from "~/shared/entities/dtos/DeleteUserByChatChannelAddressToolDTO";
import { GetBankAccountsStatusToolDTO } from "~/shared/entities/dtos/GetBankAccountsStatusToolDTO";
import { GetLatestTransactionsToolDTO } from "~/shared/entities/dtos/GetLatestTransactionsToolDTO";
import { ListTodosToolDTO } from "~/shared/entities/dtos/ListTodosToolDTO";
import { PhoneNumberToolDTO } from "~/shared/entities/dtos/PhoneNumberToolDTO";
import { SyncBankAccountBalanceToolDTO } from "~/shared/entities/dtos/SyncBankAccountBalanceToolDTO";
import { TransferBetweenBankAccountsToolDTO } from "~/shared/entities/dtos/TransferBetweenBankAccountsToolDTO";
import { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import { ToolResultStatus } from "~/shared/entities/enums/ToolResultStatus";
import type {
  Message,
  ToolCallContent,
  ToolResultContent,
} from "~/shared/entities/Message";
import type { User } from "~/shared/entities/User";

export interface AiToolContext {
  chat: Chat;
  sourceMessage: Message;
}

interface RegisteredTool extends AiToolDefinition {
  mutating: boolean;
  run(args: unknown, context: AiToolContext): Promise<unknown>;
}

export class AiToolService {
  private authService: AuthService;
  private cashFlowService: CashFlowService;
  private todoService: TodoService;
  private aiChatGateway: IAiChatGateway;
  private tools: RegisteredTool[];

  constructor(
    authService: AuthService,
    cashFlowService: CashFlowService,
    todoService: TodoService,
    aiChatGateway: IAiChatGateway,
  ) {
    this.authService = authService;
    this.cashFlowService = cashFlowService;
    this.todoService = todoService;
    this.aiChatGateway = aiChatGateway;
    this.tools = this.buildRegistry();
  }

  getDefinitions(): AiToolDefinition[] {
    return this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async execute(
    call: ToolCallContent,
    context: AiToolContext,
  ): Promise<ToolResultContent> {
    const tool = this.tools.find((t) => t.name === call.name);
    if (!tool) {
      return this.failedResult(
        call,
        "UnknownTool",
        `Unknown tool: ${call.name}`,
      );
    }
    try {
      const data = await tool.run(call.arguments ?? {}, context);
      return {
        type: MessageContentType.ToolResult,
        callId: call.callId,
        outcome: { status: ToolResultStatus.Succeeded, data },
      };
    } catch (ex) {
      if (ex instanceof ZodError) {
        return this.failedResult(
          call,
          "InvalidArguments",
          `Invalid arguments for ${call.name}: ${ex.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`,
        );
      }
      const isKnownFailure = ex instanceof AppError && ex.statusCode < 500;
      if (isKnownFailure) {
        return this.failedResult(call, ex.name, ex.message);
      }
      if (tool.mutating) {
        return {
          type: MessageContentType.ToolResult,
          callId: call.callId,
          outcome: {
            status: ToolResultStatus.Unknown,
            code: "UnconfirmedOutcome",
            message:
              "The operation may have completed, but its outcome could not be confirmed.",
          },
        };
      }
      return this.failedResult(
        call,
        "InternalError",
        "The tool could not be completed because of an internal error.",
      );
    }
  }

  private failedResult(
    call: ToolCallContent,
    code: string,
    message: string,
  ): ToolResultContent {
    return {
      type: MessageContentType.ToolResult,
      callId: call.callId,
      outcome: { status: ToolResultStatus.Failed, code, message },
    };
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
        category: z.string().trim().min(1),
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
        description:
          "Append a transaction specifying its type. Category and bank_account are automatically resolved via classification using available categories and bank accounts. Returns { message, type, category, bank_account, date, value }.",
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
          return {
            message: "Transaction added",
            type: input.type,
            category: parsed.category,
            bankAccount: parsed.bank_account,
            description: parsed.description,
            date,
            value: input.value,
          };
        },
      },
      {
        name: "transfer_between_bank_accounts",
        description:
          "Transfer a fixed amount from one bank account to another. Creates two entries: an expense on the source account and an earning on the destination account. Category and bank accounts are automatically resolved via classification using available bank accounts. Use this for credit card payments or any movement of money between accounts. Returns { message, from, to, category, description, date, value }.",
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
          await this.cashFlowService.transferBetweenBankAccounts({
            phoneNumber,
            date,
            value: input.value,
            category: parsed.category,
            description: parsed.description,
            from: parsed.from,
            to: parsed.to,
          });
          return {
            message: "Transfer completed successfully",
            from: parsed.from,
            to: parsed.to,
            category: parsed.category,
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
}
