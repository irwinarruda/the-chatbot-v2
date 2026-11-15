import { afterEach, describe, expect, test, vi } from "vitest";
import type { Chat } from "~/domain/chat/chat";
import { MessageLocale } from "~/domain/chat/message-locale";
import { ReasoningEffort } from "~/domain/chat/reasoning-effort";
import { streamWebChatResponse } from "~/server/modules/chat/controllers/stream-web-chat-response.controller";
import { createDeferred } from "~/tests/support/create-deferred";

const currentModel = { provider: "openai-codex", model: "gpt-5.6-sol" };

function createMessaging(turn: Promise<Chat | undefined>) {
  return {
    async receiveWebMessage() {
      return turn;
    },
    async getModelConfiguration() {
      return {
        currentModel,
        availableModels: [currentModel],
        supportedReasoningEfforts: [ReasoningEffort.Off],
      };
    },
  };
}

describe("streamWebChatResponse", () => {
  afterEach(() => vi.useRealTimers());

  test("sends a heartbeat line while the turn is silent and ends with the snapshot", async () => {
    vi.useFakeTimers();
    const turn = createDeferred<Chat | undefined>();
    const response = streamWebChatResponse(
      createMessaging(turn.promise),
      "user@example.com",
      { text: "Hello", clientMessageId: crypto.randomUUID() },
      MessageLocale.PtBr,
    );
    const reading = response.text();

    await vi.advanceTimersByTimeAsync(30_000);
    turn.resolve(undefined);
    const lines = (await reading).split("\n");

    expect(lines.slice(0, 2)).toEqual(["", ""]);
    expect(JSON.parse(lines[2] ?? "")).toMatchObject({
      type: "snapshot",
      chat: { messages: [], currentModel },
    });
  });

  test("stops the heartbeat once the response is finished", async () => {
    vi.useFakeTimers();
    const response = streamWebChatResponse(
      createMessaging(Promise.resolve(undefined)),
      "user@example.com",
      { text: "Hello", clientMessageId: crypto.randomUUID() },
      MessageLocale.PtBr,
    );

    await response.text();

    expect(vi.getTimerCount()).toBe(0);
  });

  test("stops the heartbeat when the client goes away", async () => {
    vi.useFakeTimers();
    const turn = createDeferred<Chat | undefined>();
    const response = streamWebChatResponse(
      createMessaging(turn.promise),
      "user@example.com",
      { text: "Hello", clientMessageId: crypto.randomUUID() },
      MessageLocale.PtBr,
    );

    await response.body?.cancel();

    expect(vi.getTimerCount()).toBe(0);
  });
});
