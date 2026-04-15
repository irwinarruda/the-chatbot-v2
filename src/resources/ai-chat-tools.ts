import { ExceptionResponse, ValidationException } from "~/infra/exceptions";
import type { AiChatMessage, IAiChatGateway } from "~/resources/IAiChatGateway";
import { AiChatMessageType, AiChatRole } from "~/resources/IAiChatGateway";
import type { AuthService } from "~/services/AuthService";
import type { CashFlowService } from "~/services/CashFlowService";
import { Printable } from "~/utils/Printable";
import { PromptLoader, PromptLocale } from "~/utils/PromptLoader";

const genericError =
  "There can be a generic error response: { message, action, name, status_code }";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      { type: string; description: string; nullable?: boolean }
    >;
    required: string[];
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "add_cash_flow_spreadsheet_url",
    description: `Associate a Google financial planning spreadsheet with a user. Fails if user not found, already has a sheet, or URL invalid. Returns { message }. ${genericError}`,
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
    description: `Fetch all transactions for the user. Returns { count, transactions: [ { sheet_id, date, value, category, description, bank_account } ] }. ${genericError}`,
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
    description: `Get the most recently appended transaction. Returns { transaction | null }. ${genericError}`,
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
    description: `Delete the last (most recent) transaction. Returns { message }. ${genericError}`,
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
    description: `Append a transaction specifying its type. Category and bank_account are automatically resolved via classification using available categories and bank accounts. Returns { message, type, category, bank_account, date, value }. ${genericError}`,
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
          description: "ISO-8601 date (if not explicit, pass in null)",
          nullable: true,
        },
      },
      required: ["phone_number", "type", "user_message", "value"],
    },
  },
  {
    name: "get_expense_categories",
    description: `List expense categories. Returns { count, categories }. ${genericError}`,
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
    description: `List earning categories. Returns { count, categories }. ${genericError}`,
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
    description: `List bank accounts referenced. Returns { count, bank_accounts }. ${genericError}`,
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
    name: "delete_user_by_phone_number",
    description: `Delete a user and all related data. Returns { message }. ${genericError}`,
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
];

interface ClassificationResult {
  category: string;
  bank_account: string;
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
      throw new ValidationException("Converted LLM response returned null");
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

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  cashFlowService: CashFlowService,
  authService: AuthService,
  aiChatGateway: IAiChatGateway,
): Promise<string> {
  try {
    switch (name) {
      case "add_cash_flow_spreadsheet_url": {
        await cashFlowService.addSpreadsheetUrl(
          args.phone_number as string,
          args.url as string,
        );
        return Printable.make({ message: "Spreadsheet linked successfully" });
      }
      case "get_all_transactions": {
        const transactions = await cashFlowService.getAllTransactions(
          args.phone_number as string,
        );
        return Printable.make({ count: transactions.length, transactions });
      }
      case "get_last_transaction": {
        const transaction = await cashFlowService.getLastTransaction(
          args.phone_number as string,
        );
        return Printable.make({ transaction: transaction ?? null });
      }
      case "delete_last_transaction": {
        await cashFlowService.deleteLastTransaction(
          args.phone_number as string,
        );
        return Printable.make({ message: "Last transaction deleted" });
      }
      case "add_transaction": {
        const phoneNumber = args.phone_number as string;
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
      case "get_expense_categories": {
        const categories = await cashFlowService.getExpenseCategories(
          args.phone_number as string,
        );
        return Printable.make({ count: categories.length, categories });
      }
      case "get_earning_categories": {
        const categories = await cashFlowService.getEarningCategories(
          args.phone_number as string,
        );
        return Printable.make({ count: categories.length, categories });
      }
      case "get_bank_accounts": {
        const banks = await cashFlowService.getBankAccount(
          args.phone_number as string,
        );
        return Printable.make({ count: banks.length, banks });
      }
      case "delete_user_by_phone_number": {
        await authService.deleteUserByPhoneNumber(args.phone_number as string);
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
