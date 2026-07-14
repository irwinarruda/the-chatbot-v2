import { describe, expect, test } from "vitest";
import { PromptLoader, PromptLocale } from "~/modules/chat/utils/PromptLoader";

describe("PromptLoader", () => {
  test("requires the clock tool before interpreting relative dates", () => {
    const prompt = PromptLoader.getAiChatGateway(PromptLocale.PtBr, {
      channelAddress: "5511999999999",
    });

    expect(prompt).toContain("chame `get_current_datetime` primeiro");
    expect(prompt).toContain("aguarde o resultado");
    expect(prompt).not.toContain("{{CurrentDateTime}}");
  });

  test("requires confirmation before completing a suggested monthly bill", () => {
    const prompt = PromptLoader.getAiChatGateway(PromptLocale.PtBr, {
      channelAddress: "5511999999999",
    });

    expect(prompt).toContain("examine `unpaid_monthly_expenses`");
    expect(prompt).toContain("sem confirmação explícita");
  });
});
