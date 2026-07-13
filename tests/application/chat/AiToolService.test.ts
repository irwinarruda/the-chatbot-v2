import { describe, expect, test } from "vitest";
import { AiToolService } from "~/modules/chat/application/AiToolService";
import { Chat } from "~/modules/chat/domain/Chat";
import { MessageContentType } from "~/modules/chat/domain/enums/MessageContentType";
import { ToolResultStatus } from "~/modules/chat/domain/enums/ToolResultStatus";
import { orquestrator } from "~/tests/orquestrator";

describe("AiToolService", () => {
  test("returns the current date in the application time zone", async () => {
    const now = new Date("2026-07-14T01:30:00.000Z");
    const service = new AiToolService(
      orquestrator.authService,
      orquestrator.cashFlowService,
      orquestrator.todoService,
      orquestrator.aiGateway,
      () => now,
    );
    const chat = new Chat();
    const sourceMessage = chat.addUserTextMessage("Que dia é hoje?");

    const result = await service.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "clock-call",
        name: "get_current_datetime",
        arguments: {},
      },
      { chat, sourceMessage },
    );

    expect(result.outcome).toEqual({
      status: ToolResultStatus.Succeeded,
      data: {
        currentDate: "2026-07-13",
        currentDateTimeUtc: "2026-07-14T01:30:00.000Z",
        timeZone: "America/Sao_Paulo",
      },
    });
  });
});
