import { describe, expect, test } from "vitest";
import { z } from "zod";
import { Chat } from "~/domain/chat/chat";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { ValidationException } from "~/domain/shared/domain-errors";
import {
  ToolExecutor,
  type ToolRoundData,
} from "~/server/modules/chat/services/tool-executor.service";

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

function createRoundTool(
  name: string,
  options: {
    mutating: boolean;
    isParallelSafe?: boolean;
    afterRound?: ToolRoundData;
    fails?: boolean;
  },
  running: { now: number; peak: number },
) {
  return {
    name,
    description: `Round test tool ${name}`,
    inputSchema: z.object({}),
    mutating: options.mutating,
    isParallelSafe: options.isParallelSafe,
    afterRound: options.afterRound,
    async run() {
      running.now++;
      running.peak = Math.max(running.peak, running.now);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running.now--;
      if (options.fails) throw new ValidationException("Record rejected");
      return { name };
    },
  };
}

function roundCall(callId: string, name: string) {
  return {
    type: MessageContentType.ToolCall,
    callId,
    name,
    arguments: {},
  } as const;
}

function roundContext() {
  const chat = new Chat();
  const sourceMessage = chat.addUserTextMessage("Record everything");
  return { chat, sourceMessage };
}

describe("ToolExecutor rounds", () => {
  test("runs parallel-safe records at the same time and keeps the call order", async () => {
    const running = { now: 0, peak: 0 };
    const executor = new ToolExecutor([
      createRoundTool(
        "record",
        { mutating: true, isParallelSafe: true },
        running,
      ),
      createRoundTool("read", { mutating: false }, running),
    ]);

    const results = await executor.executeRound(
      [
        roundCall("a", "record"),
        roundCall("b", "record"),
        roundCall("c", "read"),
      ],
      roundContext(),
    );

    expect(running.peak).toBe(3);
    expect(results.map((result) => result.callId)).toEqual(["a", "b", "c"]);
  });

  test("runs the round in order when one write is not parallel-safe", async () => {
    const running = { now: 0, peak: 0 };
    const executor = new ToolExecutor([
      createRoundTool(
        "record",
        { mutating: true, isParallelSafe: true },
        running,
      ),
      createRoundTool("delete", { mutating: true }, running),
    ]);

    const results = await executor.executeRound(
      [roundCall("a", "delete"), roundCall("b", "record")],
      roundContext(),
    );

    expect(running.peak).toBe(1);
    expect(results.map((result) => result.callId)).toEqual(["a", "b"]);
  });

  test("adds the after-round data once to every succeeded record of the round", async () => {
    const running = { now: 0, peak: 0 };
    let lookups = 0;
    let recordsRunningAtLookup = -1;
    const balances: ToolRoundData = async () => {
      lookups++;
      recordsRunningAtLookup = running.now;
      return { bankAccountBalances: [{ bankAccount: "NuConta", balance: 70 }] };
    };
    const executor = new ToolExecutor([
      createRoundTool(
        "record",
        { mutating: true, isParallelSafe: true, afterRound: balances },
        running,
      ),
      createRoundTool(
        "transfer",
        { mutating: true, isParallelSafe: true, afterRound: balances },
        running,
      ),
      createRoundTool(
        "rejected",
        {
          mutating: true,
          isParallelSafe: true,
          afterRound: balances,
          fails: true,
        },
        running,
      ),
    ]);

    const results = await executor.executeRound(
      [
        roundCall("a", "record"),
        roundCall("b", "transfer"),
        roundCall("c", "rejected"),
      ],
      roundContext(),
    );

    expect(lookups).toBe(1);
    expect(recordsRunningAtLookup).toBe(0);
    expect(results[0].outcome).toEqual({
      status: ToolResultStatus.Succeeded,
      data: {
        name: "record",
        bankAccountBalances: [{ bankAccount: "NuConta", balance: 70 }],
      },
    });
    expect(results[1].outcome).toMatchObject({
      data: { bankAccountBalances: [{ bankAccount: "NuConta", balance: 70 }] },
    });
    expect(results[2].outcome).toMatchObject({
      status: ToolResultStatus.Failed,
      code: "ValidationException",
    });
  });

  test("keeps the records when the after-round data cannot be read", async () => {
    const running = { now: 0, peak: 0 };
    const executor = new ToolExecutor([
      createRoundTool(
        "record",
        {
          mutating: true,
          isParallelSafe: true,
          afterRound: async () => {
            throw new Error("Sheet unavailable");
          },
        },
        running,
      ),
    ]);

    const [result] = await executor.executeRound(
      [roundCall("a", "record")],
      roundContext(),
    );

    expect(result.outcome).toEqual({
      status: ToolResultStatus.Succeeded,
      data: { name: "record" },
    });
  });
});
