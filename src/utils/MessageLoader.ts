import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NotFoundException } from "~/infra/exceptions";
import { resolveTemplatesDir } from "~/infra/paths";

export const MessageTemplate = {
  SignedIn: "SignedIn",
  ThankYou: "ThankYou",
  ProcessingAudio: "ProcessingAudio",
} as const;
export type MessageTemplate = ValueOf<typeof MessageTemplate>;

export const MessageLocale = {
  En: "En",
  PtBr: "PtBr",
} as const;
export type MessageLocale = ValueOf<typeof MessageLocale>;

export interface MessageParams {
  loginUrl?: string;
}

const messagesRoot = resolveTemplatesDir("messages");
const cache = new Map<string, string>();

function readFile(fileName: string): string {
  const filePath = join(messagesRoot, fileName);
  if (!existsSync(filePath)) {
    throw new NotFoundException(`Message template file not found: ${filePath}`);
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

function templateToBaseName(template: MessageTemplate): string {
  switch (template) {
    case MessageTemplate.SignedIn:
      return "signed-in-message";
    case MessageTemplate.ThankYou:
      return "thank-you-message";
    case MessageTemplate.ProcessingAudio:
      return "processing-audio-message";
    default:
      throw new Error(`Unknown message template: ${template}`);
  }
}

function localeToFileSuffix(locale: MessageLocale): string {
  switch (locale) {
    case MessageLocale.En:
      return ".en.txt";
    case MessageLocale.PtBr:
      return ".pt-BR.txt";
    default:
      return ".en.txt";
  }
}

export class MessageLoader {
  static getMessage(
    template: MessageTemplate,
    data?: MessageParams,
    locale: MessageLocale = MessageLocale.PtBr,
  ): string {
    const baseName = templateToBaseName(template);
    const fileName = baseName + localeToFileSuffix(locale);
    let text: string;
    try {
      text = readFile(fileName);
    } catch {
      text = readFile(baseName + localeToFileSuffix(MessageLocale.PtBr));
    }
    if (!data) return text;
    const dict: Record<string, string> = {};
    if (data.loginUrl != null) dict.LoginUrl = data.loginUrl;
    return applyTemplate(text, dict);
  }
}
