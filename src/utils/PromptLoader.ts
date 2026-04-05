import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { NotFoundException } from "~/infra/exceptions";

export const PromptLocale = {
  En: "En",
  PtBr: "PtBr",
} as const;
export type PromptLocale = ValueOf<typeof PromptLocale>;

export interface AiChatGatewayParams {
  phoneNumber: string;
}

const promptsRoot = resolve(process.cwd(), "templates", "prompts");
const cache = new Map<string, string>();

function readFile(fileName: string): string {
  const filePath = join(promptsRoot, fileName);
  if (!existsSync(filePath)) {
    throw new NotFoundException(`Prompt file not found: ${filePath}`);
  }
  const cached = cache.get(filePath);
  if (cached) return cached;
  const text = readFileSync(filePath, "utf-8");
  cache.set(filePath, text);
  return text;
}

function applyTemplate(text: string, data: Record<string, string>): string {
  if (Object.keys(data).length === 0) return text;
  return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key: string) => {
    return key in data ? (data[key] ?? match) : match;
  });
}

function localeToFileSuffix(locale: PromptLocale): string {
  switch (locale) {
    case PromptLocale.En:
      return ".en.md";
    case PromptLocale.PtBr:
      return ".pt-BR.md";
    default:
      return ".en.md";
  }
}

export class PromptLoader {
  static getAiChatGateway(
    locale: PromptLocale,
    data: AiChatGatewayParams,
  ): string {
    const fileBase = `ai-chat-gateway${localeToFileSuffix(locale)}`;
    const text = readFile(fileBase);
    const dict: Record<string, string> = {
      PhoneNumber: data.phoneNumber,
    };
    return applyTemplate(text, dict);
  }

  static getTransactionClassification(locale: PromptLocale): string {
    const fileBase = `transaction-classification${localeToFileSuffix(locale)}`;
    return readFile(fileBase);
  }

  static getSummarization(
    locale: PromptLocale,
    existingSummary: string | undefined,
  ): string {
    const fileBase = `summarization${localeToFileSuffix(locale)}`;
    const text = readFile(fileBase);
    const dict: Record<string, string> = {
      ExistingSummary: existingSummary ?? "",
    };
    return applyTemplate(text, dict);
  }
}
