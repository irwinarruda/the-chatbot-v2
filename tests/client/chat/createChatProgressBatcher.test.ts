import { afterEach, describe, expect, test, vi } from "vitest";
import { createChatProgressBatcher } from "~/modules/chat/client/state/createChatProgressBatcher";

describe("createChatProgressBatcher", () => {
  afterEach(() => vi.useRealTimers());

  test("publishes a complete burst once per frame", async () => {
    vi.useFakeTimers();
    const flushed = vi.fn();
    const batcher = createChatProgressBatcher(flushed);

    for (let index = 0; index < 100; index++) {
      batcher.push({
        type: "reasoningDelta",
        round: 1,
        contentIndex: 0,
        delta: index === 99 ? "end" : "x",
      });
    }

    expect(flushed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(16);

    expect(flushed).toHaveBeenCalledTimes(1);
    expect(flushed).toHaveBeenLastCalledWith({
      rounds: [
        {
          round: 1,
          reasoning: [{ contentIndex: 0, text: `${"x".repeat(99)}end` }],
          tools: [],
        },
      ],
    });
  });

  test("cancels pending deltas before an authoritative snapshot", async () => {
    vi.useFakeTimers();
    const flushed = vi.fn();
    const batcher = createChatProgressBatcher(flushed);
    batcher.push({
      type: "reasoningDelta",
      round: 1,
      contentIndex: 0,
      delta: "stale",
    });

    batcher.cancel();
    await vi.advanceTimersByTimeAsync(16);

    expect(flushed).not.toHaveBeenCalled();
  });
});
