import { describe, expect, test } from "vitest";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import { PiAiChatGateway } from "~/modules/chat/gateway/AiChatGateway/PiAiChatGateway";

function createGateway() {
  return new PiAiChatGateway({
    provider: "zai",
    apiKey: "test",
    model: "glm-5.2",
    maxOutputTokens: 4096,
    safetyMarginTokens: 16_384,
    minRecentTurns: 4,
    maxToolRounds: 8,
  });
}

describe("PiAiChatGateway", () => {
  test("exposes only distinct provider reasoning levels", () => {
    const gateway = createGateway();

    expect(gateway.getSupportedReasoningEfforts()).toEqual([
      ReasoningEffort.Off,
      ReasoningEffort.High,
      ReasoningEffort.Max,
    ]);
  });

  test("input estimates exclude repeated response-only generation metadata", () => {
    const gateway = createGateway();
    const generation = {
      id: crypto.randomUUID(),
      provider: "zai",
      model: "glm-5.2",
      api: "openai-completions",
      finishReason: "stop",
      usage: {
        input: 100_000,
        output: 100_000,
        cacheRead: 100_000,
        cacheWrite: 100_000,
        totalTokens: 400_000,
        cost: {
          input: 100,
          output: 100,
          cacheRead: 100,
          cacheWrite: 100,
          total: 400,
        },
      },
      diagnostics: ["x".repeat(10_000)],
      timestamp: 1,
    };
    const messages = [
      {
        role: MessageRole.Assistant,
        content: { type: MessageContentType.Text, text: "Short answer" },
        generation,
        timestamp: 1,
      },
    ];
    const withMetadata = gateway.estimateInputTokens({
      channelAddress: "user@example.com",
      messages,
      tools: [],
    });
    const withoutMetadata = gateway.estimateInputTokens({
      channelAddress: "user@example.com",
      messages: [
        {
          ...messages[0],
          generation: {
            id: generation.id,
            finishReason: generation.finishReason,
            timestamp: generation.timestamp,
          },
        },
      ],
      tools: [],
    });

    expect(withMetadata).toBe(withoutMetadata);
  });
});
