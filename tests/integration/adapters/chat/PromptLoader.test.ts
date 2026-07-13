import { describe, expect, test } from "vitest";
import { PromptLoader, PromptLocale } from "~/modules/chat/server/PromptLoader";

describe("PromptLoader", () => {
  test("requires the clock tool before interpreting relative dates", () => {
    const prompt = PromptLoader.getAiChatGateway(PromptLocale.PtBr, {
      channelAddress: "5511999999999",
    });

    expect(prompt).toContain("chame `get_current_datetime` primeiro");
    expect(prompt).toContain("aguarde o resultado");
    expect(prompt).not.toContain("{{CurrentDateTime}}");
  });
});
