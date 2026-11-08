import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { Chat } from "~/domain/chat/chat";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ToolResultStatus } from "~/domain/chat/tool-result-status";
import { ValidationException } from "~/domain/shared/domain-errors";
import {
  type AfterRoundLoader,
  type AiToolContext,
  ToolExecutor,
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
    afterRound?: AfterRoundLoader;
    fails?: boolean;
  },
  log: { running: number; peak: number; writes: string[] },
) {
  return {
    name,
    description: `Round test tool ${name}`,
    inputSchema: z.object({ delay: z.number().optional() }),
    mutating: options.mutating,
    isParallelSafe: options.isParallelSafe,
    afterRound: options.afterRound,
    async run(args: unknown, context: AiToolContext) {
      const { delay } = z.object({ delay: z.number().optional() }).parse(args);
      log.running++;
      log.peak = Math.max(log.peak, log.running);
      await new Promise((resolve) => setTimeout(resolve, delay ?? 20));
      log.running--;
      if (options.fails) throw new ValidationException("Record rejected");
      const write = async () => {
        log.writes.push(context.sourceMessage.text ?? "");
      };
      const inCallOrder = context.inCallOrder;
      await (inCallOrder ? inCallOrder(write) : write());
      return { name };
    },
  };
}

function roundCall(callId: string, name: string, delay?: number) {
  return {
    type: MessageContentType.ToolCall,
    callId,
    name,
    arguments: { delay },
  } as const;
}

function roundContext() {
  const chat = new Chat();
  const sourceMessage = chat.addUserTextMessage("Record everything");
  return { chat, sourceMessage };
}

function createLog() {
  return { running: 0, peak: 0, writes: [] as string[] };
}

describe("ToolExecutor rounds", () => {
  test("runs a batch of parallel-safe records together, at most four at a time", async () => {
    const log = createLog();
    const executor = new ToolExecutor([
      createRoundTool("record", { mutating: true, isParallelSafe: true }, log),
    ]);
    const calls = ["a", "b", "c", "d", "e", "f"].map((id) =>
      roundCall(id, "record"),
    );

    const results = await executor.executeRound(calls, roundContext());

    expect(log.peak).toBe(4);
    expect(results.map((result) => result.callId)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  test("writes the records of a batch in call order when the first one is slowest", async () => {
    const log = createLog();
    const executor = new ToolExecutor([
      {
        ...createRoundTool(
          "record",
          { mutating: true, isParallelSafe: true },
          log,
        ),
        async run(args: unknown, context: AiToolContext) {
          const { delay } = z.object({ delay: z.number() }).parse(args);
          await new Promise((resolve) => setTimeout(resolve, delay));
          await context.inCallOrder?.(async () => {
            log.writes.push(String(delay));
          });
          return {};
        },
      },
    ]);

    await executor.executeRound(
      [
        roundCall("pizza", "record", 60),
        roundCall("sorvete", "record", 5),
        roundCall("pastel", "record", 30),
      ],
      roundContext(),
    );

    expect(log.writes).toEqual(["60", "5", "30"]);
  });

  test("runs a read after a record in order, so the read sees the record", async () => {
    const log = createLog();
    const executor = new ToolExecutor([
      createRoundTool("record", { mutating: true, isParallelSafe: true }, log),
      createRoundTool("read", { mutating: false }, log),
    ]);

    const results = await executor.executeRound(
      [roundCall("a", "record"), roundCall("b", "read")],
      roundContext(),
    );

    expect(log.peak).toBe(1);
    expect(results.map((result) => result.callId)).toEqual(["a", "b"]);
  });

  test("runs the round in order when one write is not parallel-safe", async () => {
    const log = createLog();
    const executor = new ToolExecutor([
      createRoundTool("record", { mutating: true, isParallelSafe: true }, log),
      createRoundTool("delete", { mutating: true }, log),
    ]);

    const results = await executor.executeRound(
      [roundCall("a", "delete"), roundCall("b", "record")],
      roundContext(),
    );

    expect(log.peak).toBe(1);
    expect(results.map((result) => result.callId)).toEqual(["a", "b"]);
  });

  test("adds the after-round data once to every succeeded record of the round", async () => {
    const log = createLog();
    let lookups = 0;
    let recordsRunningAtLookup = -1;
    const balances: AfterRoundLoader = async () => {
      lookups++;
      recordsRunningAtLookup = log.running;
      return { bankAccountBalances: [{ bankAccount: "NuConta", balance: 70 }] };
    };
    const executor = new ToolExecutor([
      createRoundTool(
        "record",
        { mutating: true, isParallelSafe: true, afterRound: balances },
        log,
      ),
      createRoundTool(
        "transfer",
        { mutating: true, isParallelSafe: true, afterRound: balances },
        log,
      ),
      createRoundTool(
        "rejected",
        {
          mutating: true,
          isParallelSafe: true,
          afterRound: balances,
          fails: true,
        },
        log,
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
    const log = createLog();
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
        log,
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

  test("answers without the after-round data when it takes too long", async () => {
    vi.useFakeTimers();
    try {
      const log = createLog();
      const executor = new ToolExecutor([
        createRoundTool(
          "record",
          {
            mutating: true,
            isParallelSafe: true,
            afterRound: () => new Promise(() => {}),
          },
          log,
        ),
      ]);

      const pending = executor.executeRound(
        [roundCall("a", "record")],
        roundContext(),
      );
      await vi.advanceTimersByTimeAsync(5_100);
      const [result] = await pending;

      expect(result.outcome).toEqual({
        status: ToolResultStatus.Succeeded,
        data: { name: "record" },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
