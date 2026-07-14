import { beforeEach, describe, expect, test } from "vitest";
import { Chat } from "~/modules/chat/entities/Chat";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";
import { orquestrator } from "~/tests/orquestrator";

describe("monthly expense AI tools", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("creates, lists, and completes a recurring bill for the authenticated user", async () => {
    const user = await orquestrator.createUser();
    const chat = new Chat();
    chat.idUser = user.id;
    const sourceMessage = chat.addUserTextMessage(
      "Cadastre a conta de energia todo mês",
    );

    const created = await orquestrator.aiToolService.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "create-monthly-expense",
        name: "create_monthly_expense",
        arguments: {
          name: "Conta de energia",
          expected_amount: 150,
          due_day: 12,
        },
      },
      { chat, sourceMessage },
    );
    expect(created.outcome).toMatchObject({
      status: ToolResultStatus.Succeeded,
      data: {
        expense: {
          name: "Conta de energia",
          expectedAmount: 150,
          isPaid: false,
        },
      },
    });
    const [expense] =
      await orquestrator.monthlyExpenseService.listMonthlyExpenses(user.id);

    const paid = await orquestrator.aiToolService.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "pay-monthly-expense",
        name: "set_monthly_expense_paid",
        arguments: { expense_id: expense.expense.id, is_paid: true },
      },
      { chat, sourceMessage },
    );
    const listed = await orquestrator.aiToolService.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "list-monthly-expenses",
        name: "list_monthly_expenses",
        arguments: { status: "Paid" },
      },
      { chat, sourceMessage },
    );

    expect(paid.outcome).toMatchObject({
      status: ToolResultStatus.Succeeded,
      data: { expense: { isPaid: true } },
    });
    expect(listed.outcome).toMatchObject({
      status: ToolResultStatus.Succeeded,
      data: { count: 1 },
    });
  });
});
