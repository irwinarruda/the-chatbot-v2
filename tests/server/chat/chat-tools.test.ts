import { describe, expect, test } from "vitest";
import { Chat } from "~/domain/chat/chat";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { createChatTools } from "~/server/modules/chat/controllers/chat.tools";
import { ToolExecutor } from "~/server/modules/chat/services/tool-executor.service";

describe("chat tools", () => {
  test("returns the current date in the application time zone", async () => {
    const now = new Date("2026-07-14T01:30:00.000Z");
    const tools = new ToolExecutor(createChatTools(() => now));
    const chat = new Chat();
    const sourceMessage = chat.addUserTextMessage("Que dia é hoje?");

    const result = await tools.execute(
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

  test("tells the model which button label is too long, so it can call again", async () => {
    const tools = new ToolExecutor(createChatTools());
    const chat = new Chat();
    const sourceMessage = chat.addUserTextMessage("Paguei a academia");

    const result = await tools.execute(
      {
        type: MessageContentType.ToolCall,
        callId: "reply-call",
        name: "reply_with_options",
        arguments: {
          message: "Quer marcar a Academia como paga?",
          options: ["Sim, marcar como paga", "Não"],
        },
      },
      { chat, sourceMessage },
    );

    expect(result.outcome).toEqual({
      status: ToolResultStatus.Failed,
      code: "InvalidArguments",
      message:
        "Invalid arguments for reply_with_options: options.0: A button label has at most 20 characters",
    });
  });

  test("tells the model to call the options reply alone when it arrives with other tools", async () => {
    const tools = new ToolExecutor(createChatTools());
    const chat = new Chat();
    const sourceMessage = chat.addUserTextMessage("Paguei a academia");

    const [result] = await tools.executeRound(
      [
        {
          type: MessageContentType.ToolCall,
          callId: "reply-call",
          name: "reply_with_options",
          arguments: {
            message: "Quer marcar a Academia como paga?",
            options: ["Sim", "Não"],
          },
        },
        {
          type: MessageContentType.ToolCall,
          callId: "clock-call",
          name: "get_current_datetime",
          arguments: {},
        },
      ],
      { chat, sourceMessage },
    );

    expect(result.outcome).toEqual({
      status: ToolResultStatus.Failed,
      code: "ValidationException",
      message:
        "The options were not sent because reply_with_options was called together with other tools. Call it again alone, after their results.",
    });
  });
});
