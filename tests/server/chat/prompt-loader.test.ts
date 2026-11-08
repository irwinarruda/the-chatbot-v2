import { describe, expect, test } from "vitest";
import {
  PromptLoader,
  PromptLocale,
} from "~/server/modules/chat/utils/prompt-loader";

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

  test("ends a cash-flow record with the balances of the accounts it touched", () => {
    const prompt = PromptLoader.getAiChatGateway(PromptLocale.PtBr, {
      channelAddress: "5511999999999",
    });

    expect(prompt).toContain(
      "`add_transaction`, `transfer_between_bank_accounts` ou `sync_bank_account_balance`",
    );
    expect(prompt).toContain(
      "espere todos os registros terminarem e chame `get_bank_accounts_status` sem data, uma única vez",
    );
    expect(prompt).toContain(
      "Termine a mensagem com o saldo atual de cada conta que recebeu um registro",
    );
    expect(prompt).toContain("Mostre só essas contas");
    expect(prompt).toContain(
      "chame `get_bank_accounts_status` antes, em uma rodada separada",
    );
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
