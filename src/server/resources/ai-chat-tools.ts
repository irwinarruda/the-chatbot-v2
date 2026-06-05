import { ExceptionResponse, ValidationException } from "~/infra/exceptions";
import type {
  AiChatContext,
  AiChatMessage,
  IAiChatGateway,
} from "~/server/resources/IAiChatGateway";
import {
  AiChatMessageType,
  AiChatRole,
} from "~/server/resources/IAiChatGateway";
import type { AuthService } from "~/server/services/AuthService";
import type { CashFlowService } from "~/server/services/CashFlowService";
import type { TodoService } from "~/server/services/TodoService";
import { Printable } from "~/server/utils/Printable";
import { PromptLoader, PromptLocale } from "~/server/utils/PromptLoader";
import { TodoStatus } from "~/shared/entities/enums/TodoStatus";
import type { User } from "~/shared/entities/User";

type ToolParameterSchema = {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameterSchema;
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameterSchema>;
    required: string[];
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "create_todos",
    description: [
      "Create one or more todos for the authenticated user.",
      "Use this when the user asks to remember, note, create a task, save something to do later, or when an audio transcription contains clear tasks.",
      "One message may contain multiple todos. Extract each actionable item.",
      "Prefer one call with multiple todo objects when there is more than one.",
      "Use a short, clear, action-oriented name.",
      "Add description only when important details would be lost from the name.",
      "If the name is enough, leave description empty.",
      "Set dueDate only when the user explicitly gives or clearly implies a date. Do not invent today's date for undated tasks.",
      "If the message came from audio, create todos normally; the system will bind them to the source message.",
      "Do not create todos for casual conversation unless the intent to save an action is clear.",
      "Returns { message, todos }.",
    ].join("\n"),
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
        todos: {
          type: "array",
          description:
            "Todos extracted from the user message or recent context",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Short actionable todo title",
              },
              description: {
                type: "string",
                description:
                  "Optional detail. Leave empty when the title captures the whole request",
              },
              dueDate: {
                type: "string",
                description:
                  "Optional ISO-8601 due date. Omit when the user does not provide a due date",
              },
              status: {
                type: "string",
                enum: [TodoStatus.Pending, TodoStatus.Completed],
                description: "Initial todo status, normally Pending",
              },
            },
            required: ["name", "status"],
          },
        },
      },
      required: ["phone_number", "todos"],
    },
  },
  {
    name: "list_todos",
    description:
      "List todos for the user filtered by status. Returns { count, todos }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
        status: {
          type: "string",
          enum: [TodoStatus.Pending, TodoStatus.Completed],
          description: "Filter todos by status",
        },
      },
      required: ["phone_number", "status"],
    },
  },
  {
    name: "add_cash_flow_spreadsheet_url",
    description:
      "Associate a Google financial planning spreadsheet with a user. Fails if user not found, already has a sheet, or URL invalid. Returns { message }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
        url: { type: "string", description: "Google Spreadsheet URL" },
      },
      required: ["phone_number", "url"],
    },
  },
  {
    name: "get_all_transactions",
    description:
      "Fetch all transactions for the user. Returns { count, transactions: [ { sheet_id, date, value, category, description, bank_account } ] }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "get_last_transaction",
    description:
      "Get the most recently appended transaction. Returns { transaction? }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "delete_last_transaction",
    description:
      "Delete the last (most recent) transaction. Returns { message }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "add_transaction",
    description:
      "Append a transaction specifying its type. Category and bank_account are automatically resolved via classification using available categories and bank accounts. Returns { message, type, category, bank_account, date, value }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
        type: {
          type: "string",
          description: "Transaction type: Expense or Earning",
        },
        user_message: {
          type: "string",
          description:
            "Full original user message text with all context and nuances; pass exactly what the user sent",
        },
        value: {
          type: "number",
          description: "Monetary value (positive number)",
        },
        date: {
          type: "string",
          description: "ISO-8601 date (if not explicit, omit this field)",
        },
      },
      required: ["phone_number", "type", "user_message", "value"],
    },
  },
  {
    name: "transfer_between_bank_accounts",
    description:
      "Transfer a fixed amount from one bank account to another. Creates two entries: an expense on the source account and an earning on the destination account. Category and bank accounts are automatically resolved via classification using available bank accounts. Use this for credit card payments or any movement of money between accounts. Returns { message, from, to, category, description, date, value }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
        user_message: {
          type: "string",
          description:
            "Full original user message text with all context and nuances; pass exactly what the user sent",
        },
        value: {
          type: "number",
          description: "Amount to transfer (positive number)",
        },
        date: {
          type: "string",
          description:
            "Optional ISO-8601 date (if not explicit, omit this field)",
        },
      },
      required: ["phone_number", "user_message", "value"],
    },
  },
  {
    name: "get_expense_categories",
    description: "List expense categories. Returns { count, categories }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "get_earning_categories",
    description: "List earning categories. Returns { count, categories }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "get_bank_accounts",
    description:
      "List bank accounts referenced. Returns { count, bank_accounts }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "get_bank_accounts_status",
    description:
      "List bank accounts with nonzero balances for a month. If date is omitted, uses the current date. Returns { count, bank_accounts: [ { bank_account, balance } ] }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
        date: {
          type: "string",
          description: "Optional ISO-8601 date for the target month",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "sync_bank_account_balance",
    description:
      "Reconcile a bank account's tracked balance with the real balance reported by the user. Automatically computes the difference and creates an earning (if money appeared, e.g. interest) or expense (if money disappeared) transaction to bring the spreadsheet in sync. Bank account, category, and description are automatically resolved via classification. Returns { message }.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description: "User phone number in E.164 format",
        },
        user_message: {
          type: "string",
          description:
            "Full original user message text with all context and nuances; pass exactly what the user sent",
        },
        current_balance: {
          type: "number",
          description:
            "The real current balance of the bank account as reported by the user",
        },
        date: {
          type: "string",
          description:
            "Optional ISO-8601 date (if not explicit, omit this field)",
        },
      },
      required: ["phone_number", "user_message", "current_balance"],
    },
  },
  {
    name: "delete_user_by_chat_channel_address",
    description:
      "Delete the current user and all related data. Returns { message }.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

interface ClassificationResult {
  category: string;
  bank_account: string;
  description: string;
}

interface TransferClassificationResult {
  category: string;
  from: string;
  to: string;
  description: string;
}

async function classifyWithRetry(
  aiChatGateway: IAiChatGateway,
  phoneNumber: string,
  type: string,
  userMessage: string,
  value: number,
  categories: string[],
  bankAccounts: string[],
  attempt = 1,
): Promise<ClassificationResult> {
  try {
    const prompt = PromptLoader.getTransactionClassification(PromptLocale.PtBr);
    const payload = Printable.make({
      type,
      description: userMessage,
      value,
      categories,
      bankAccounts,
    });
    const messages: AiChatMessage[] = [
      { role: AiChatRole.System, type: AiChatMessageType.Text, text: prompt },
      { role: AiChatRole.User, type: AiChatMessageType.Text, text: payload },
    ];
    const response = await aiChatGateway.getResponse(
      phoneNumber,
      messages,
      false,
    );
    const result = Printable.convert<ClassificationResult>(response.text);
    if (!result)
      throw new ValidationException("Converted LLM response returned no value");
    return result;
  } catch (err) {
    if (attempt > 5) {
      const errMsg =
        err instanceof Error ? err.message + (err.stack ?? "") : String(err);
      throw new ValidationException(
        `Could not determine classification or bank account. ${errMsg}`,
      );
    }
    return classifyWithRetry(
      aiChatGateway,
      phoneNumber,
      type,
      userMessage,
      value,
      categories,
      bankAccounts,
      attempt + 1,
    );
  }
}

async function classifyTransferWithRetry(
  aiChatGateway: IAiChatGateway,
  phoneNumber: string,
  userMessage: string,
  value: number,
  bankAccounts: string[],
  attempt = 1,
): Promise<TransferClassificationResult> {
  try {
    const prompt = PromptLoader.getTransferClassification(PromptLocale.PtBr);
    const payload = Printable.make({
      type: "Transfer",
      description: userMessage,
      value,
      bankAccounts,
    });
    const messages: AiChatMessage[] = [
      { role: AiChatRole.System, type: AiChatMessageType.Text, text: prompt },
      { role: AiChatRole.User, type: AiChatMessageType.Text, text: payload },
    ];
    const response = await aiChatGateway.getResponse(
      phoneNumber,
      messages,
      false,
    );
    const result = Printable.convert<TransferClassificationResult>(
      response.text,
    );
    if (!result)
      throw new ValidationException("Converted LLM response returned no value");
    return result;
  } catch (err) {
    if (attempt > 5) {
      const errMsg =
        err instanceof Error ? err.message + (err.stack ?? "") : String(err);
      throw new ValidationException(
        `Could not determine transfer classification. ${errMsg}`,
      );
    }
    return classifyTransferWithRetry(
      aiChatGateway,
      phoneNumber,
      userMessage,
      value,
      bankAccounts,
      attempt + 1,
    );
  }
}

async function resolveToolUser(
  args: Record<string, unknown>,
  authService: AuthService,
  channelAddress: string,
): Promise<User> {
  const userByEmail = await authService.getUserByEmail(
    channelAddress.toLowerCase(),
  );
  if (userByEmail) return userByEmail;
  const userByChannelAddress =
    await authService.getUserByChatChannelAddress(channelAddress);
  if (userByChannelAddress) return userByChannelAddress;
  const phoneNumber = args.phone_number as string;
  const user = await authService.getUserByPhoneNumber(phoneNumber);
  if (!user) throw new ValidationException("User not found");
  return user;
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

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cashFlowService: CashFlowService,
  authService: AuthService,
  todoService: TodoService,
  aiChatGateway: IAiChatGateway,
  channelAddress: string,
  context?: AiChatContext,
): Promise<string> {
  try {
    switch (name) {
      case "create_todos": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const idSourceMessage =
          typeof context?.idSourceMessage === "string"
            ? context.idSourceMessage
            : undefined;
        const todos = Array.isArray(args.todos) ? args.todos : [];
        const created = await todoService.createTodos(
          todos.map((todo) => {
            const item = todo as Record<string, unknown>;
            const dueDate =
              typeof item.dueDate === "string" && item.dueDate
                ? new Date(item.dueDate)
                : undefined;
            return {
              idUser: user.id,
              idSourceMessage,
              name: item.name as string,
              description:
                typeof item.description === "string"
                  ? item.description
                  : undefined,
              dueDate,
              status:
                item.status === TodoStatus.Completed
                  ? TodoStatus.Completed
                  : TodoStatus.Pending,
            };
          }),
        );
        return Printable.make({
          message: "Todos created",
          todos: created.map((todo) => todo.toJSON()),
        });
      }
      case "list_todos": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const status =
          args.status === TodoStatus.Completed
            ? TodoStatus.Completed
            : TodoStatus.Pending;
        const todos = await todoService.listTodos(user.id, { status });
        return Printable.make({
          count: todos.length,
          todos: todos.map((t) => t.toJSON()),
        });
      }
      case "add_cash_flow_spreadsheet_url": {
        const user = await resolveToolUser(args, authService, channelAddress);
        await cashFlowService.addSpreadsheetUrl(
          requireCashFlowPhone(user),
          args.url as string,
        );
        return Printable.make({ message: "Spreadsheet linked successfully" });
      }
      case "get_all_transactions": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const transactions = await cashFlowService.getAllTransactions(
          requireCashFlowPhone(user),
        );
        return Printable.make({ count: transactions.length, transactions });
      }
      case "get_last_transaction": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const transaction = await cashFlowService.getLastTransaction(
          requireCashFlowPhone(user),
        );
        return Printable.make(transaction === undefined ? {} : { transaction });
      }
      case "delete_last_transaction": {
        const user = await resolveToolUser(args, authService, channelAddress);
        await cashFlowService.deleteLastTransaction(requireCashFlowPhone(user));
        return Printable.make({ message: "Last transaction deleted" });
      }
      case "add_transaction": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const phoneNumber = requireCashFlowPhone(user);
        const type = args.type as string;
        const userMessage = args.user_message as string;
        const value = args.value as number;
        const date = args.date ? new Date(args.date as string) : new Date();
        const { categories, bankAccounts } =
          await cashFlowService.getCategoriesAndBankAccounts(phoneNumber);
        const parsed = await classifyWithRetry(
          aiChatGateway,
          phoneNumber,
          type,
          userMessage,
          value,
          categories,
          bankAccounts,
        );
        if (type === "Expense") {
          await cashFlowService.addExpense({
            phoneNumber,
            date,
            value,
            category: parsed.category,
            description: parsed.description,
            bankAccount: parsed.bank_account,
          });
        } else {
          await cashFlowService.addEarning({
            phoneNumber,
            date,
            value,
            category: parsed.category,
            description: parsed.description,
            bankAccount: parsed.bank_account,
          });
        }
        return Printable.make({
          message: "Transaction added",
          type,
          category: parsed.category,
          bankAccount: parsed.bank_account,
          description: parsed.description,
          date,
          value,
        });
      }
      case "transfer_between_bank_accounts": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const phoneNumber = requireCashFlowPhone(user);
        const userMessage = args.user_message as string;
        const value = args.value as number;
        const date = args.date ? new Date(args.date as string) : new Date();
        const { bankAccounts } =
          await cashFlowService.getCategoriesAndBankAccounts(phoneNumber);
        const parsed = await classifyTransferWithRetry(
          aiChatGateway,
          phoneNumber,
          userMessage,
          value,
          bankAccounts,
        );
        await cashFlowService.transferBetweenBankAccounts({
          phoneNumber,
          date,
          value,
          category: parsed.category,
          description: parsed.description,
          from: parsed.from,
          to: parsed.to,
        });
        return Printable.make({
          message: "Transfer completed successfully",
          from: parsed.from,
          to: parsed.to,
          category: parsed.category,
          description: parsed.description,
          date,
          value,
        });
      }
      case "get_expense_categories": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const categories = await cashFlowService.getExpenseCategories(
          requireCashFlowPhone(user),
        );
        return Printable.make({ count: categories.length, categories });
      }
      case "get_earning_categories": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const categories = await cashFlowService.getEarningCategories(
          requireCashFlowPhone(user),
        );
        return Printable.make({ count: categories.length, categories });
      }
      case "get_bank_accounts": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const banks = await cashFlowService.getBankAccount(
          requireCashFlowPhone(user),
        );
        return Printable.make({ count: banks.length, banks });
      }
      case "get_bank_accounts_status": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const date =
          typeof args.date === "string" ? new Date(args.date) : undefined;
        const bankAccounts = await cashFlowService.getBankAccountsStatus(
          requireCashFlowPhone(user),
          date,
        );
        return Printable.make({
          count: bankAccounts.length,
          bankAccounts: bankAccounts,
        });
      }
      case "sync_bank_account_balance": {
        const user = await resolveToolUser(args, authService, channelAddress);
        const phoneNumber = requireCashFlowPhone(user);
        const userMessage = args.user_message as string;
        const currentBalance = args.current_balance as number;
        const date = args.date ? new Date(args.date as string) : new Date();
        const { categories, bankAccounts } =
          await cashFlowService.getCategoriesAndBankAccounts(phoneNumber);
        const parsed = await classifyWithRetry(
          aiChatGateway,
          phoneNumber,
          "Earning",
          userMessage,
          currentBalance,
          categories,
          bankAccounts,
        );
        await cashFlowService.syncBankAccountBalance({
          phoneNumber,
          bankAccount: parsed.bank_account,
          currentBalance,
          category: parsed.category,
          description: parsed.description,
          date,
        });
        return Printable.make({
          message: "Bank account balance synced successfully",
        });
      }
      case "delete_user_by_chat_channel_address": {
        await authService.deleteUserByChatChannelAddress(channelAddress);
        return Printable.make({
          message: "The account was deleted successfully",
        });
      }
      default:
        return Printable.make({ message: `Unknown tool: ${name}` });
    }
  } catch (ex) {
    const response = ExceptionResponse.handle(ex);
    return Printable.make(response);
  }
}
