import { afterEach, describe, expect, test, vi } from "vitest";
import { webChatService } from "~/modules/chat/client/services/webChatService";
import type { WebChatResponseEventDTO } from "~/modules/chat/entities/dtos/ChatDTO";

function encodeEvent(event: WebChatResponseEventDTO): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

describe("webChatService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

    const chat = await webChatService.sendMessage(
      { text: "Check todos", clientMessageId: crypto.randomUUID() },
      (event) => progress.push(event),
    );

    expect(progress).toEqual(events.slice(0, 2));
    expect(chat).toEqual(events[2]?.type === "snapshot" && events[2].chat);
  });
});
