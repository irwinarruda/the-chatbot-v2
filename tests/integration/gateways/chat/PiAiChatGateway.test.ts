import type { CredentialStore } from "@earendil-works/pi-ai";
import { describe, expect, test, vi } from "vitest";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import { PiAiChatGateway } from "~/modules/chat/gateway/AiChatGateway/PiAiChatGateway";

function createGateway() {
  return new PiAiChatGateway({
    provider: "zai",
    apiKey: "test",
    model: "glm-5.2",
  });
}

describe("PiAiChatGateway", () => {
  test("uses the selected model native output capacity", () => {
    const gateway = createGateway();
    const model = gateway.getDefaultModel();

    expect(gateway.getMaxOutputTokens(model)).toBe(131_072);
  });

  test("exposes only distinct provider reasoning levels", () => {
    const gateway = createGateway();

    expect(
      gateway.getSupportedReasoningEfforts(gateway.getDefaultModel()),
    ).toEqual([ReasoningEffort.Off, ReasoningEffort.High, ReasoningEffort.Max]);
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
      idUser: "test-user",
      model: gateway.getDefaultModel(),
      channelAddress: "user@example.com",
      messages,
      tools: [],
    });
    const withoutMetadata = gateway.estimateInputTokens({
      idUser: "test-user",
      model: gateway.getDefaultModel(),
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

  test("provider failures never log raw credential response details", async () => {
    const secretResponse = JSON.stringify({
      access_token: "access-secret-value",
      refresh_token: "refresh-secret-value",
      authorization_code: "authorization-secret-value",
      api_key: "provider-specific-secret-value",
    });
    const credentials: CredentialStore = {
      read: async () => {
        throw new Error(secretResponse);
      },
      list: async () => [{ providerId: "openai-codex", type: "oauth" }],
      modify: async () => {
        throw new Error(secretResponse);
      },
      delete: async () => {},
    };
    const gateway = new PiAiChatGateway(
      {
        provider: "openai-codex",
        model: "gpt-5.6-luna",
      },
      { create: () => credentials },
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        gateway.generateText(
          "test-user",
          gateway.getDefaultModel(),
          "system",
          "user",
        ),
      ).rejects.toThrow("provider could not complete the request");

      expect(log).toHaveBeenCalledWith(
        "[AI provider failure] openai-codex/gpt-5.6-luna: request_failed",
      );
      expect(log.mock.calls.flat().join(" ")).not.toContain(secretResponse);
    } finally {
      log.mockRestore();
    }
  });
});
