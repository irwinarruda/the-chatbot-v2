import { describe, expect, test, vi } from "vitest";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import { MessageRole } from "~/modules/chat/entities/enums/MessageRole";
import { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import {
  type AiCredentialStoreFactory,
  PiAiChatGateway,
} from "~/modules/chat/gateway/AiChatGateway/PiAiChatGateway";
import type { AiCredentialStore } from "~/modules/chat/gateway/AiCredentialStore";

function createGateway() {
  return new PiAiChatGateway({
    provider: "zai",
    apiKey: "test",
    model: "glm-5.2",
  });
}

describe("PiAiChatGateway", () => {
  test("starts with GLM-5.2 on the China Coding Plan", async () => {
    const gateway = new PiAiChatGateway({
      provider: "zai-coding-cn",
      apiKey: "test",
      model: "glm-5.2",
    });
    const selection = gateway.getDefaultModel();

    expect(selection).toEqual({ provider: "zai-coding-cn", model: "glm-5.2" });
    expect(gateway.getContextWindowTokens(selection)).toBe(1_000_000);
    expect(gateway.getMaxOutputTokens(selection)).toBe(131_072);
    expect(gateway.getSupportedReasoningEfforts(selection)).toEqual([
      ReasoningEffort.Off,
      ReasoningEffort.High,
      ReasoningEffort.Max,
    ]);
    await expect(gateway.getAvailableModels("test-user")).resolves.toEqual(
      expect.arrayContaining([
        { provider: "zai-coding-cn", model: "glm-5.2" },
        { provider: "zai-coding-cn", model: "glm-5.3" },
      ]),
    );
  });

  test.each(["environment", "stored"])(
    "routes GLM-5.2 through the China endpoint with %s credentials",
    async (source) => {
      const credentials: AiCredentialStore = {
        read: async (providerId) => {
          if (providerId !== "zai-coding-cn") return undefined;
          return { type: "api_key", key: "stored-cn-key" };
        },
        list: async () => [{ providerId: "zai-coding-cn", type: "api_key" }],
        modify: async (_providerId, update) => update(undefined),
        delete: async () => {},
      };
      let credentialStores: AiCredentialStoreFactory | undefined;
      let expectedKey = "environment-cn-key";
      if (source === "stored") {
        credentialStores = { create: () => credentials };
        expectedKey = "stored-cn-key";
      }
      const gateway = new PiAiChatGateway(
        {
          provider: "zai-coding-cn",
          apiKey: "environment-cn-key",
          model: "glm-5.2",
        },
        credentialStores,
      );
      const chunk = {
        id: "test-completion",
        object: "chat.completion.chunk",
        created: 1,
        model: "glm-5.2",
        choices: [
          {
            index: 0,
            delta: { content: "China plan reply" },
            finish_reason: "stop",
          },
        ],
      };
      const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
      try {
        await expect(
          gateway.generateText(
            "test-user",
            gateway.getDefaultModel(),
            "system",
            "hello",
          ),
        ).resolves.toBe("China plan reply");
        expect(fetch).toHaveBeenCalledOnce();
        const [url, options] = fetch.mock.calls[0];
        expect(String(url)).toBe(
          "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions",
        );
        expect(new Headers(options?.headers).get("authorization")).toBe(
          `Bearer ${expectedKey}`,
        );
        expect(JSON.parse(String(options?.body))).toMatchObject({
          model: "glm-5.2",
        });
      } finally {
        fetch.mockRestore();
      }
    },
  );

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

  test("exposes GLM-5.3 models from the Z.AI catalog", async () => {
    const gateway = createGateway();

    await expect(gateway.getAvailableModels("test-user")).resolves.toEqual(
      expect.arrayContaining([
        { provider: "zai", model: "glm-5.3" },
        { provider: "zai", model: "glm-5.3-flash" },
      ]),
    );
    expect(
      gateway.getSupportedReasoningEfforts({
        provider: "zai",
        model: "glm-5.3",
      }),
    ).toEqual([ReasoningEffort.Low, ReasoningEffort.High, ReasoningEffort.Max]);
  });

  test("exposes each model ID once across configured providers", async () => {
    const credentials: AiCredentialStore = {
      read: async (providerId) => {
        if (providerId !== "openai-codex") return undefined;
        return {
          type: "oauth",
          refresh: "refresh-token",
          access: "access-token",
          expires: Date.now() + 60_000,
        };
      },
      list: async () => [{ providerId: "openai-codex", type: "oauth" }],
      modify: async (_providerId, update) =>
        update({
          type: "oauth",
          refresh: "refresh-token",
          access: "access-token",
          expires: Date.now() + 60_000,
        }),
      delete: async () => {},
    };
    const gateway = new PiAiChatGateway(
      {
        provider: "openai",
        apiKey: "test",
        model: "gpt-5.4",
      },
      { create: () => credentials },
    );

    const models = await gateway.getAvailableModels("test-user");

    expect(models.filter((model) => model.model === "gpt-5.4")).toEqual([
      { provider: "openai", model: "gpt-5.4" },
    ]);
    expect(new Set(models.map((model) => model.model)).size).toBe(
      models.length,
    );
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
    const credentials: AiCredentialStore = {
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
