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
        text: "You spent *R$ 842.30* on groceries in November, across 6 transactions, _about 12% less_ than October. They are under `Groceries` in your sheet: https://sheets.example.com/ada/finance",
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
        "# Lisbon trip\n\n**Dates:** December 12 to 18, *booked*\n\n## To book\n\n- [x] Flights\n- [ ] Apartment in Alfama\n- [ ] Day trip to Sintra\n\n### Check-in\n\n[Online](https://example.com), code:\n\n```\nK7Q2XM\n```\n\n## Food\n\n> Ask Marco about the bakery near the river.\n",
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
    bankAccounts: ["Nubank", "Itaú", "Credit card", "Savings box", "Cash"],
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
      { bankAccount: "Credit card", balance: -1284.3 },
      { bankAccount: "Savings box", balance: 12000 },
      { bankAccount: "Cash", balance: 340 },
    ],
  };
}

function createMonthlyExpenses(): MonthlyExpenseResponseDTO[] {
  return [
    ["Rent", 2400, 5, true, "Housing", "Itaú"],
    ["Electricity", 186.4, 15, true, "Utilities", "Nubank"],
    ["Internet", 119.9, 12, false, "Utilities", "Nubank"],
    ["Phone", 59.9, 20, false, "Utilities", undefined],
    ["Gym", 99, 28, false, undefined, undefined],
  ].map(
    (
      [name, expectedAmount, dueDay, isPaid, category, defaultBankAccount],
      index,
    ) => ({
      id: demoId(501 + index),
      name: name as string,
      expectedAmount: expectedAmount as number,
      dueDay: dueDay as number,
      category: category as string | undefined,
      defaultBankAccount: defaultBankAccount as string | undefined,
      month: DemoMonth,
      isPaid: isPaid as boolean,
      paidAt: isPaid ? at(2) : undefined,
      createdAt: at(1),
      updatedAt: at(2),
    }),
  );
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
    renderedHtml: createArtifactHtml(title as string),
    createdAt: at(1),
    updatedAt: at(day as number),
  }));
}

function createArtifactHtml(title: string): string {
  const rows = [
    ["Housing", "R$ 2,400.00", "R$ 2,400.00", "on track"],
    ["Groceries", "R$ 900.00", "R$ 842.30", "on track"],
    ["Utilities", "R$ 450.00", "R$ 366.20", "on track"],
    ["Transport", "R$ 300.00", "R$ 338.90", "over"],
  ]
    .map(
      ([category, budget, spent, status]) =>
        `<tr><td>${category}</td><td>${budget}</td><td>${spent}</td><td><span class="pill ${status === "over" ? "over" : ""}">${status}</span></td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
:root{color-scheme:light dark;--bg:#ffffff;--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--card:#f6f8fa;--accent:#0969da;--warn:#bc4c00}
@media (prefers-color-scheme: dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;--card:#161b22;--accent:#4493f8;--warn:#f0883e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 24px}h1{font-size:28px;margin:0 0 4px}p.lead{color:var(--muted);margin:0 0 28px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px}.wrap{overflow-x:auto}td,th{white-space:nowrap}@media (max-width:480px){main{padding:24px 16px}h1{font-size:24px}th,td{padding:8px 4px;font-size:13px}.pill{padding:1px 6px}}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.stat b{display:block;font-size:22px}.stat span{color:var(--muted);font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600}
.pill{font-size:12px;padding:2px 8px;border-radius:99px;background:var(--card);border:1px solid var(--line)}.pill.over{color:var(--warn)}
</style></head><body><main><h1>${title}</h1><p class="lead">November 2026 · prepared for Marco</p>
<section class="stats"><div class="stat"><span>Planned</span><b>R$ 4,050</b></div><div class="stat"><span>Spent so far</span><b>R$ 3,947</b></div><div class="stat"><span>Left this month</span><b>R$ 103</b></div></section>
<div class="wrap"><table><thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></main></body></html>`;
}
