import { describe, expect, test } from "vitest";
import { parseChatCommand } from "~/modules/chat/utils/ChatCommandParser";

describe("ChatCommandParser", () => {
  test("keeps effort commands compatible", () => {
    expect(parseChatCommand(" /EFFORT HIGH ")).toEqual({
      raw: "/EFFORT HIGH",
      name: "effort",
      arguments: { level: "high" },
    });
    expect(parseChatCommand("/effort")).toEqual({
      raw: "/effort",
      name: "effort",
      arguments: {},
    });
  });

  test("parses model status commands without a selection", () => {
    expect(parseChatCommand(" /MoDeL ")).toEqual({
      raw: "/MoDeL",
      name: "model",
      arguments: {},
    });
  });

  test("normalizes the provider and preserves the model ID", () => {
    expect(parseChatCommand(" /model OpenAI-Codex/GPT-5.3-Codex ")).toEqual({
      raw: "/model OpenAI-Codex/GPT-5.3-Codex",
      name: "model",
      arguments: {
        locator: "openai-codex/GPT-5.3-Codex",
        provider: "openai-codex",
        model: "GPT-5.3-Codex",
      },
    });
  });

  test.each([
    "/model zai",
    "/model /glm-5.2",
    "/model zai/",
    "/model zai/glm-5.2 extra",
    "/model\nzai/glm-5.2 extra",
  ])("keeps malformed known model command %s out of model context", (raw) => {
    const command = parseChatCommand(raw);

    expect(command).toMatchObject({
      name: "model",
      arguments: { locator: raw.replace(/^\/model\s*/i, "") },
    });
    expect(command?.arguments.provider).toBeUndefined();
    expect(command?.arguments.model).toBeUndefined();
  });

  test("does not parse unrelated slash-prefixed text", () => {
    expect(parseChatCommand("/models zai/glm-5.2")).toBeUndefined();
    expect(parseChatCommand("/help")).toBeUndefined();
  });
});
