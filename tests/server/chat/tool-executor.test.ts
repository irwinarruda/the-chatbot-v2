import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Chat } from "~/domain/chat/chat";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { ValidationException } from "~/domain/shared/domain-errors";
import { ToolExecutor } from "~/server/modules/chat/services/tool-executor.service";

async function executeFailingTool(error: Error, mutating: boolean) {
  const executor = new ToolExecutor([
    {
      name: "test_tool",
      description: "Test failure translation",
      inputSchema: z.object({}),
      mutating,
      async run() {
        throw error;
      },
    },
  ]);
  const chat = new Chat();
  const sourceMessage = chat.addUserTextMessage("Run the tool");
  return executor.execute(
    {
      type: MessageContentType.ToolCall,
      callId: "test-call",
      name: "test_tool",
      arguments: {},
    },
    { chat, sourceMessage },
  );
}

describe("ToolExecutor", () => {
  test.each([true, false])(
    "reports domain validation as a known failure when mutating is %s",
    async (mutating) => {
      const result = await executeFailingTool(
        new ValidationException("Todo name is required"),
        mutating,
      );

      expect(result).toEqual({
        type: MessageContentType.ToolResult,
        callId: "test-call",
        outcome: {
          status: ToolResultStatus.Failed,
          code: "ValidationException",
          message: "Todo name is required",
        },
      });
    },
  );

  test("preserves an unknown outcome for unexpected mutation failures", async () => {
    const result = await executeFailingTool(new Error("Connection lost"), true);

    expect(result.outcome).toMatchObject({
      status: ToolResultStatus.Unknown,
      code: "UnconfirmedOutcome",
    });
  });

  test("does not expose unexpected read failures", async () => {
    const result = await executeFailingTool(
      new Error("Private details"),
      false,
    );

    expect(result.outcome).toEqual({
      status: ToolResultStatus.Failed,
      code: "InternalError",
      message: "The tool could not be completed because of an internal error.",
    });
  });
});
