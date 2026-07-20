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

  test("separates notes from todos and keeps chat edits append-only", () => {
    const prompt = PromptLoader.getAiChatGateway(PromptLocale.PtBr, {
      channelAddress: "5511999999999",
    });

    expect(prompt).toContain("Use tarefas somente para ações concretas");
    expect(prompt).toContain("Use notas para ideias, links, referências");
    expect(prompt).toContain("Edições de notas pelo chat apenas acrescentam");
    expect(prompt).toContain("adapte-a para a formatação do WhatsApp");
  });
});
