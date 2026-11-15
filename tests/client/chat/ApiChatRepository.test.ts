import { afterEach, describe, expect, test, vi } from "vitest";
import { apiChatRepository } from "~/client/modules/chat/app/repositories/ApiChatRepository";
import type { WebChatResponseEventDTO } from "~/contracts/http/chat/chat";

function encodeEvent(event: WebChatResponseEventDTO): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

const snapshot: WebChatResponseEventDTO = {
  type: "snapshot",
  chat: {
    messages: [],
    currentModel: { provider: "openai-codex", model: "gpt-5.6-sol" },
    availableModels: [{ provider: "openai-codex", model: "gpt-5.6-sol" }],
    reasoningEffort: "off",
    supportedReasoningEfforts: ["off"],
  },
};

function stubChatStream(
  start: (controller: ReadableStreamDefaultController<Uint8Array>) => void,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new ReadableStream({ start }))),
  );
}

function sendHello() {
  return apiChatRepository.sendMessage({
    text: "Hello",
    clientMessageId: crypto.randomUUID(),
  });
}

describe("apiChatRepository", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("consumes progress events before returning the final snapshot", async () => {
    const events: WebChatResponseEventDTO[] = [
      {
        type: "reasoningDelta",
        round: 1,
        contentIndex: 0,
        delta: "Checking",
      },
      {
        type: "toolCall",
        round: 1,
        contentIndex: 1,
        callId: "call-1",
        name: "list_todos",
        arguments: {},
      },
      {
        type: "snapshot",
        chat: {
          messages: [],
          currentModel: {
            provider: "openai-codex",
            model: "gpt-5.6-sol",
          },
          availableModels: [
            { provider: "openai-codex", model: "gpt-5.6-sol" },
            { provider: "zai-coding-cn", model: "glm-5.2" },
          ],
          reasoningEffort: "high",
          supportedReasoningEfforts: ["off", "high"],
        },
      },
    ];
    const response = new Response(
      new ReadableStream({
        start(controller) {
          for (const event of events) controller.enqueue(encodeEvent(event));
          controller.close();
        },
      }),
      { status: 200 },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const progress: WebChatResponseEventDTO[] = [];

    const chat = await apiChatRepository.sendMessage(
      { text: "Check todos", clientMessageId: crypto.randomUUID() },
      (event) => progress.push(event),
    );

    expect(progress).toEqual(events.slice(0, 2));
    expect(chat).toEqual(events[2]?.type === "snapshot" && events[2].chat);
  });

  test("reports a lost connection when the request cannot reach the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(sendHello()).resolves.toBeUndefined();
  });

  test("reports a lost connection when the stream ends before the snapshot", async () => {
    stubChatStream((controller) => {
      controller.enqueue(
        encodeEvent({
          type: "reasoningDelta",
          round: 1,
          contentIndex: 0,
          delta: "Checking",
        }),
      );
      controller.enqueue(encodeEvent(snapshot).slice(0, 20));
      controller.close();
    });

    await expect(sendHello()).resolves.toBeUndefined();
  });

  test("reports a lost connection when the stream breaks", async () => {
    stubChatStream((controller) => {
      controller.error(new TypeError("network error"));
    });

    await expect(sendHello()).resolves.toBeUndefined();
  });

  test("reports a lost connection after 45 seconds of silence", async () => {
    vi.useFakeTimers();
    stubChatStream(() => {});

    const sending = sendHello();
    await vi.advanceTimersByTimeAsync(45_000);

    await expect(sending).resolves.toBeUndefined();
  });

  test("heartbeat lines keep a quiet stream alive until the snapshot", async () => {
    vi.useFakeTimers();
    const heartbeat = new TextEncoder().encode("\n");
    stubChatStream((controller) => {
      setTimeout(() => controller.enqueue(heartbeat), 30_000);
      setTimeout(() => controller.enqueue(heartbeat), 60_000);
      setTimeout(() => {
        controller.enqueue(encodeEvent(snapshot));
        controller.close();
      }, 90_000);
    });

    const sending = sendHello();
    await vi.advanceTimersByTimeAsync(90_000);

    await expect(sending).resolves.toEqual(
      snapshot.type === "snapshot" && snapshot.chat,
    );
  });

  test("rejects when the server reports that the response failed", async () => {
    stubChatStream((controller) => {
      controller.enqueue(
        encodeEvent({ type: "error", message: "The chat response failed." }),
      );
      controller.close();
    });

    await expect(sendHello()).rejects.toMatchObject({
      message: "The chat response failed.",
      statusCode: 500,
    });
  });

  test("rejects when the server refuses the message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status: 400 })),
    );

    await expect(sendHello()).rejects.toMatchObject({ statusCode: 400 });
  });
});
