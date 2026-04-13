import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NotFoundException } from "~/infra/exceptions";
import { Paths } from "~/infra/paths";

export const PromptLocale = {
  En: "En",
  PtBr: "PtBr",
} as const;
export type PromptLocale = ValueOf<typeof PromptLocale>;

export interface AiChatGatewayParams {
  phoneNumber: string;
}

export class PromptLoader {
  private static cache = new Map<string, string>();

  private static readFile(fileName: string): string {
    const filePath = join(Paths.templatesDir("prompts"), fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Prompt file not found: ${filePath}`);
    }
    const cached = PromptLoader.cache.get(filePath);
    if (cached) return cached;
    const text = readFileSync(filePath, "utf-8");
    PromptLoader.cache.set(filePath, text);
    return text;
  }

  private static applyTemplate(
    text: string,
    data: Record<string, string>,
  ): string {
    if (Object.keys(data).length === 0) return text;
    return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key: string) => {
      return key in data ? (data[key] ?? match) : match;
    });
  }

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
    const text = PromptLoader.readFile(fileBase);
    const dict: Record<string, string> = {
      PhoneNumber: data.phoneNumber,
    };
    return PromptLoader.applyTemplate(text, dict);
  }

  static getTransactionClassification(locale: PromptLocale): string {
    const fileBase = `transaction-classification${PromptLoader.localeToFileSuffix(locale)}`;
    return PromptLoader.readFile(fileBase);
  }

  static getSummarization(
    locale: PromptLocale,
    existingSummary: string | undefined,
  ): string {
    const fileBase = `summarization${PromptLoader.localeToFileSuffix(locale)}`;
    const text = PromptLoader.readFile(fileBase);
    const dict: Record<string, string> = {
      ExistingSummary: existingSummary ?? "",
    };
    return PromptLoader.applyTemplate(text, dict);
  }
}
