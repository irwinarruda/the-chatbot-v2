import type { ArtifactViewerDTO } from "~/contracts/http/artifacts/artifact";
import type { CashFlowDashboardResponseDTO } from "~/contracts/http/cash-flow/cash-flow";
import type { MonthlyExpenseResponseDTO } from "~/contracts/http/cash-flow/monthly-expense";
import type { WebChatDTO } from "~/contracts/http/chat/chat";
import type { CurrentUserDTO } from "~/contracts/http/identity/identity";
import type { NoteResponseDTO } from "~/contracts/http/notes/note";
import type { TodoResponseDTO } from "~/contracts/http/todos/todo";
import { ArtifactVisibility } from "~/domain/artifacts/artifact-visibility";
import { CashFlowTransactionType } from "~/domain/cash-flow/cash-flow-transaction-type";
import { ReasoningEffort } from "~/domain/chat/reasoning-effort";

export const DemoNow = "2026-11-03T15:00:00.000Z";
export const DemoMonth = "2026-11";

export interface MockDb {
  user: CurrentUserDTO;
  chat: WebChatDTO;
  todos: TodoResponseDTO[];
  notes: NoteResponseDTO[];
  cashFlow: CashFlowDashboardResponseDTO;
  monthlyExpenses: MonthlyExpenseResponseDTO[];
  artifacts: ArtifactViewerDTO[];
  isUploadTokenConfigured: boolean;
}

export function demoId(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

export const mockDb: MockDb = createDemoData();

export function resetMockDb(): void {
  Object.assign(mockDb, createDemoData());
}

function at(day: number, hour = 12, minute = 0): string {
  const date = new Date(Date.UTC(2026, 10, day, hour + 3, minute));
  return date.toISOString();
}

function createDemoData(): MockDb {
  return {
    user: {
      id: demoId(1),
      name: "Ada Hale",
      email: "ada@example.com",
      phoneNumber: "5511900000000",
    },
    chat: createChat(),
    todos: createTodos(),
    notes: createNotes(),
    cashFlow: createCashFlow(),
    monthlyExpenses: createMonthlyExpenses(),
    artifacts: createArtifacts(),
    isUploadTokenConfigured: true,
  };
}

function createChat(): WebChatDTO {
  return {
    currentModel: { provider: "openai", model: "gpt-5.5" },
    availableModels: [
      { provider: "openai", model: "gpt-5.5" },
      { provider: "anthropic", model: "claude-opus-5-5" },
      { provider: "zai-coding-cn", model: "glm-5.2" },
    ],
    reasoningEffort: ReasoningEffort.Medium,
    supportedReasoningEfforts: [
      ReasoningEffort.Off,
      ReasoningEffort.Low,
      ReasoningEffort.Medium,
      ReasoningEffort.High,
    ],
    messages: [
      {
        id: demoId(101),
        type: "text",
        userType: "user",
        text: "Add oat milk and coffee beans to my todos, and remind me to renew my passport by Friday.",
        createdAt: at(3, 9, 12),
      },
      {
        id: demoId(102),
        type: "text",
        userType: "bot",
        text: "Done. I added *oat milk* and *coffee beans*, and a todo to _renew your passport_ due Friday, November 6.",
        trace: [
          {
            id: demoId(201),
            provider: "openai",
            model: "gpt-5.5",
            reasoningEffort: ReasoningEffort.Medium,
            finishReason: "stop",
            items: [
              {
                type: "reasoning",
                text: "Two shopping items and one dated todo. Friday is November 6.",
              },
              {
                type: "toolCall",
                callId: "call-create-todos",
                name: "create_todos",
                arguments: {
                  todos: [
                    { name: "Oat milk" },
                    { name: "Coffee beans" },
                    { name: "Renew passport", due_date: "2026-11-06" },
                  ],
                },
              },
              {
                type: "toolResult",
                callId: "call-create-todos",
                outcome: { status: "succeeded", data: { count: 3 } },
              },
            ],
          },
        ],
        createdAt: at(3, 9, 12),
      },
      {
        id: demoId(103),
        type: "text",
        userType: "user",
        text: "How much did I spend on groceries this month?",
        createdAt: at(3, 9, 20),
      },
      {
        id: demoId(104),
        type: "text",
        userType: "bot",
        text: "You spent *R$ 842.30* on groceries in November, across 6 transactions. That is about 12% less than October.",
        createdAt: at(3, 9, 20),
      },
      {
        id: demoId(105),
        type: "interactive",
        userType: "bot",
        text: "I found a R$ 119.90 charge from your internet provider on November 2. Should I mark *Internet* as paid for November?",
        buttonReplyOptions: ["Yes, mark it paid", "Not yet"],
        createdAt: at(3, 9, 21),
      },
    ],
  };
}

function createTodos(): TodoResponseDTO[] {
  return [
    {
      id: demoId(301),
      name: "Renew passport",
      description: "Bring the old passport and two photos.",
      dueDate: "2026-11-06T12:00:00.000Z",
      status: "Pending",
      createdAt: at(3, 9, 12),
      updatedAt: at(3, 9, 12),
    },
    {
      id: demoId(302),
      name: "Oat milk",
      description: "",
      status: "Pending",
      createdAt: at(3, 9, 12),
      updatedAt: at(3, 9, 12),
    },
    {
      id: demoId(303),
      name: "Coffee beans",
      description: "Medium roast, whole beans.",
      status: "Pending",
      createdAt: at(3, 9, 12),
      updatedAt: at(3, 9, 12),
    },
    {
      id: demoId(304),
      name: "Send the Q4 budget to Marco",
      description: "Use the artifact link, not the spreadsheet.",
      dueDate: "2026-11-03T12:00:00.000Z",
      status: "Pending",
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: demoId(305),
      name: "Book the dentist",
      description: "",
      dueDate: "2026-10-30T12:00:00.000Z",
      status: "Pending",
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: demoId(306),
      name: "Pay the electricity bill",
      description: "",
      dueDate: "2026-11-02T12:00:00.000Z",
      status: "Completed",
      createdAt: at(1),
      updatedAt: at(2),
    },
  ];
}

function createNotes(): NoteResponseDTO[] {
  return [
    {
      id: demoId(401),
      name: "Lisbon trip",
      markdown:
        "# Lisbon trip\n\n**Dates:** December 12 to 18\n\n## To book\n\n- [x] Flights\n- [ ] Apartment in Alfama\n- [ ] Day trip to Sintra\n\n## Food\n\n> Ask Marco about the bakery near the river.\n",
      createdAt: at(1, 18),
      updatedAt: at(3, 8, 40),
    },
    {
      id: demoId(402),
      name: "Reading list",
      markdown:
        "# Reading list\n\n1. *The Overstory*\n2. *Piranesi*\n3. *Project Hail Mary*\n",
      createdAt: at(1, 20),
      updatedAt: at(2, 21),
    },
    {
      id: demoId(403),
      name: "Q4 goals",
      markdown:
        "# Q4 goals\n\n- Keep groceries under **R$ 900** a month\n- Run 3 times a week\n- Finish the Favo theme rollout\n",
      createdAt: at(1, 9),
      updatedAt: at(1, 9),
    },
  ];
}

function createCashFlow(): CashFlowDashboardResponseDTO {
  const transactions: CashFlowDashboardResponseDTO["transactions"] = [
    [
      "2026-11-01",
      9800,
      CashFlowTransactionType.Earning,
      "Salary",
      "November salary",
      "Nubank",
    ],
    [
      "2026-11-01",
      -2400,
      CashFlowTransactionType.Expense,
      "Housing",
      "Rent",
      "Nubank",
    ],
    [
      "2026-11-02",
      -186.4,
      CashFlowTransactionType.Expense,
      "Utilities",
      "Electricity",
      "Nubank",
    ],
    [
      "2026-11-02",
      -119.9,
      CashFlowTransactionType.Expense,
      "Utilities",
      "Internet",
      "Itaú",
    ],
    [
      "2026-11-02",
      -214.75,
      CashFlowTransactionType.Expense,
      "Groceries",
      "Weekly groceries",
      "Nubank",
    ],
    [
      "2026-11-02",
      1200,
      CashFlowTransactionType.Earning,
      "Freelance",
      "Logo design",
      "Itaú",
    ],
    [
      "2026-11-03",
      -38.9,
      CashFlowTransactionType.Expense,
      "Transport",
      "Ride home",
      "Nubank",
    ],
    [
      "2026-11-03",
      -62.5,
      CashFlowTransactionType.Expense,
      "Restaurants",
      "Lunch with Marco",
      "Cash",
    ],
    [
      "2026-11-03",
      -127.4,
      CashFlowTransactionType.Expense,
      "Groceries",
      "Farmers market",
      "Nubank",
    ],
  ].map(
    ([date, value, type, category, description, bankAccount], position) => ({
      position,
      date: date as string,
      value: value as number,
      type: type as CashFlowTransactionType,
      category: category as string,
      description: description as string,
      bankAccount: bankAccount as string,
      isLast: false,
    }),
  );
  transactions[transactions.length - 1].isLast = true;
  return {
    transactions,
    bankAccounts: ["Nubank", "Itaú", "Cash"],
    expenseCategories: [
      "Groceries",
      "Housing",
      "Restaurants",
      "Transport",
      "Utilities",
    ],
    earningCategories: ["Salary", "Freelance", "Interest"],
    bankAccountStatuses: [
      { bankAccount: "Nubank", balance: 18432.55 },
      { bankAccount: "Itaú", balance: 6210.1 },
      { bankAccount: "Cash", balance: 340 },
    ],
  };
}

function createMonthlyExpenses(): MonthlyExpenseResponseDTO[] {
  return [
    ["Rent", 2400, 5, true],
    ["Electricity", 186.4, 15, true],
    ["Internet", 119.9, 12, false],
    ["Phone", 59.9, 20, false],
    ["Gym", 99, 28, false],
  ].map(([name, expectedAmount, dueDay, isPaid], index) => ({
    id: demoId(501 + index),
    name: name as string,
    expectedAmount: expectedAmount as number,
    dueDay: dueDay as number,
    month: DemoMonth,
    isPaid: isPaid as boolean,
    paidAt: isPaid ? at(2) : undefined,
    createdAt: at(1),
    updatedAt: at(2),
  }));
}

function createArtifacts(): ArtifactViewerDTO[] {
  return [
    ["Q4 budget review", ArtifactVisibility.Public, 3, 2],
    ["Lisbon itinerary", ArtifactVisibility.Private, 1, 3],
    ["Reading stats 2026", ArtifactVisibility.Public, 2, 1],
  ].map(([title, visibility, version, day], index) => ({
    id: demoId(601 + index),
    title: title as string,
    visibility: visibility as ArtifactVisibility,
    version: version as number,
    renderedHtml: `<!doctype html><html><body><h1>${title}</h1><p>A published artifact in demo mode.</p></body></html>`,
    createdAt: at(1),
    updatedAt: at(day as number),
  }));
}
