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

  test("parses compact commands without arguments", () => {
    expect(parseChatCommand(" /CoMpAcT ")).toEqual({
      raw: "/CoMpAcT",
      name: "compact",
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

  test("preserves the model ID without a provider locator", () => {
    expect(parseChatCommand(" /model GPT-5.3-Codex ")).toEqual({
      raw: "/model GPT-5.3-Codex",
      name: "model",
      arguments: { model: "GPT-5.3-Codex" },
    });
  });

  test.each([
    "/model zai",
    "/model /glm-5.2",
    "/model zai/",
    "/model zai/glm-5.2 extra",
    "/model\nzai/glm-5.2 extra",
  ])("keeps invalid model selection %s for service validation", (raw) => {
    const command = parseChatCommand(raw);

    expect(command).toMatchObject({
      name: "model",
      arguments: { model: raw.replace(/^\/model\s*/i, "") },
    });
  });

  test("does not parse unrelated slash-prefixed text", () => {
    expect(parseChatCommand("/models zai/glm-5.2")).toBeUndefined();
    expect(parseChatCommand("/compact now")).toBeUndefined();
    expect(parseChatCommand("/help")).toBeUndefined();
  });
});
