import { beforeEach, describe, expect, test } from "vitest";
import { Chat } from "~/domain/chat/chat";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { User } from "~/domain/identity/user";
import { createAppGoogleLoginState } from "~/tests/support/create-app-google-login-state";
import { orquestrator } from "~/tests/support/orchestrator";

describe("cash-flow AI tools", () => {
  beforeEach(async () => {
    orquestrator.cashFlowSpreadsheetGateway.reset();
    orquestrator.aiGateway.scriptedTexts = [];
    await orquestrator.clearDatabase();
  });

  async function createUserWithSpreadsheet(phoneNumber: string) {
    const user = new User("Test User", phoneNumber);
    user.bsuid = phoneNumber;
    await orquestrator.authService.createUser(user);
    const state = await createAppGoogleLoginState(
      orquestrator.authService,
      phoneNumber,
    );
    await orquestrator.authService.handleGoogleRedirect(state, "rightCode");
    await orquestrator.cashFlowService.addSpreadsheetUrl(
      phoneNumber,
      `https://docs.google.com/spreadsheets/d/${orquestrator.googleSheetsConfig.testSheetId}/edit`,
    );
    return user;
  }

  test("records a batch together and returns the balance after every record", async () => {
    const phoneNumber = "5511987654321";
    const user = await createUserWithSpreadsheet(phoneNumber);
    await orquestrator.cashFlowService.addEarning({
      phoneNumber,
      date: new Date(),
      value: 1000,
      category: "Salário",
      description: "Salário",
      bankAccount: "NuConta",
    });
    orquestrator.aiGateway.scriptedTexts.push(
      JSON.stringify({
        category: "Delivery",
        bank_account: "NuConta",
        description: "Pizza",
      }),
      JSON.stringify({
        category: "Delivery",
        bank_account: "NuConta",
        description: "Sorvete",
      }),
    );
    const chat = new Chat();
    chat.idUser = user.id;
    const sourceMessage = chat.addUserTextMessage(
      "Registre na NuConta: 40 de pizza e 25,50 de sorvete",
    );

    const results = await orquestrator.aiToolService.executeRound(
      [
        {
          type: MessageContentType.ToolCall,
          callId: "pizza",
          name: "add_transaction",
          arguments: { type: "Expense", value: 40, user_message: "40 pizza" },
        },
        {
          type: MessageContentType.ToolCall,
          callId: "sorvete",
          name: "add_transaction",
          arguments: {
            type: "Expense",
            value: 25.5,
            user_message: "25,50 sorvete",
          },
        },
      ],
      { chat, sourceMessage },
    );

    expect(results.map((result) => result.callId)).toEqual([
      "pizza",
      "sorvete",
    ]);
    for (const result of results) {
      expect(result.outcome).toMatchObject({
        status: ToolResultStatus.Succeeded,
        data: {
          bankAccount: "NuConta",
          bankAccountBalances: [{ bankAccount: "NuConta", balance: 934.5 }],
        },
      });
    }
  });
});
