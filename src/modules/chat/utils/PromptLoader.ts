import { Paths } from "~/infra/paths";
import { ChatTemplateLoader } from "./ChatTemplateLoader";

export const PromptLocale = {
  En: "En",
  PtBr: "PtBr",
} as const;
export type PromptLocale = ValueOf<typeof PromptLocale>;

export interface AiChatGatewayParams {
  channelAddress: string;
}

export class PromptLoader {
  private static readonly templates = new ChatTemplateLoader(
    Paths.templatesDir("prompts"),
    "Prompt file",
  );

  private static localeToFileSuffix(locale: PromptLocale): string {
    switch (locale) {
      case PromptLocale.En:
        return ".en.md";
      case PromptLocale.PtBr:
        return ".pt-BR.md";
      default:
        return ".en.md";
    }
  }

  static getAiChatGateway(
    locale: PromptLocale,
    data: AiChatGatewayParams,
  ): string {
    const fileBase = `ai-chat-gateway${PromptLoader.localeToFileSuffix(locale)}`;
    const dict: Record<string, string> = {
      PhoneNumber: data.channelAddress,
      ChannelAddress: data.channelAddress,
    };
    return PromptLoader.templates.load(fileBase, dict);
  }

  static getTransactionClassification(locale: PromptLocale): string {
    const fileBase = `transaction-classification${PromptLoader.localeToFileSuffix(locale)}`;
    return PromptLoader.templates.load(fileBase);
  }

  static getTransferClassification(locale: PromptLocale): string {
    const fileBase = `transfer-classification${PromptLoader.localeToFileSuffix(locale)}`;
    return PromptLoader.templates.load(fileBase);
  }

  static getConversationMemory(
    locale: PromptLocale,
    memoryData: string,
  ): string {
    const fileBase = `conversation-memory${PromptLoader.localeToFileSuffix(locale)}`;
    return PromptLoader.templates.load(fileBase, { MemoryData: memoryData });
  }

  static getSummarization(
    locale: PromptLocale,
    existingSummary: string | undefined,
  ): string {
    const fileBase = `summarization${PromptLoader.localeToFileSuffix(locale)}`;
    const dict: Record<string, string> = {
      ExistingSummary: existingSummary ?? "",
    };
    return PromptLoader.templates.load(fileBase, dict);
  }
}
