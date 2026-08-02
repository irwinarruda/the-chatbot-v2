import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Paths } from "~/infra/paths";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";

export const MessageTemplate = {
  SignedIn: "SignedIn",
  ThankYou: "ThankYou",
  ProcessingAudio: "ProcessingAudio",
  ToolRoundsExceeded: "ToolRoundsExceeded",
  UnexpectedError: "UnexpectedError",
  EffortStatus: "EffortStatus",
  EffortInvalid: "EffortInvalid",
  EffortUpdated: "EffortUpdated",
  ModelStatus: "ModelStatus",
  ModelInvalid: "ModelInvalid",
  ModelUpdated: "ModelUpdated",
} as const;
export type MessageTemplate = ValueOf<typeof MessageTemplate>;

export const MessageLocale = {
  En: "En",
  PtBr: "PtBr",
} as const;
export type MessageLocale = ValueOf<typeof MessageLocale>;

export function toMessageLocale(locale: string): MessageLocale {
  if (locale === "en") return MessageLocale.En;
  return MessageLocale.PtBr;
}

export interface MessageParams {
  loginUrl?: string;
  reasoningEffort?: string;
  requestedReasoningEffort?: string;
  supportedReasoningEfforts?: string;
  activeModelLocator?: string;
  availableModelLocators?: string;
  requestedModelLocator?: string;
  effortResetNote?: string;
}

export class MessageLoader {
  private static cache = new Map<string, string>();

  private static readFile(fileName: string): string {
    const filePath = join(Paths.templatesDir("messages"), fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `Message template file not found: ${filePath}`,
      );
    }
    const cached = MessageLoader.cache.get(filePath);
    if (cached) return cached;
    const text = readFileSync(filePath, "utf-8");
    MessageLoader.cache.set(filePath, text);
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

  private static templateToBaseName(template: MessageTemplate): string {
    switch (template) {
      case MessageTemplate.SignedIn:
        return "signed-in-message";
      case MessageTemplate.ThankYou:
        return "thank-you-message";
      case MessageTemplate.ProcessingAudio:
        return "processing-audio-message";
      case MessageTemplate.ToolRoundsExceeded:
        return "tool-rounds-exceeded-message";
      case MessageTemplate.UnexpectedError:
        return "unexpected-error-message";
      case MessageTemplate.EffortStatus:
        return "effort-status-message";
      case MessageTemplate.EffortInvalid:
        return "effort-invalid-message";
      case MessageTemplate.EffortUpdated:
        return "effort-updated-message";
      case MessageTemplate.ModelStatus:
        return "model-status-message";
      case MessageTemplate.ModelInvalid:
        return "model-invalid-message";
      case MessageTemplate.ModelUpdated:
        return "model-updated-message";
      default:
        throw new Error(`Unknown message template: ${template}`);
    }
  }

  private static localeToFileSuffix(locale: MessageLocale): string {
    switch (locale) {
      case MessageLocale.En:
        return ".en.txt";
      case MessageLocale.PtBr:
        return ".pt-BR.txt";
      default:
        return ".en.txt";
    }
  }

  static getMessage(
    template: MessageTemplate,
    data?: MessageParams,
    locale: MessageLocale = MessageLocale.PtBr,
  ): string {
    const baseName = MessageLoader.templateToBaseName(template);
    const fileName = baseName + MessageLoader.localeToFileSuffix(locale);
    let text: string;
    try {
      text = MessageLoader.readFile(fileName);
    } catch {
      text = MessageLoader.readFile(
        baseName + MessageLoader.localeToFileSuffix(MessageLocale.PtBr),
      );
    }
    if (!data) return text;
    const dict: Record<string, string> = {};
    if (data.loginUrl !== undefined) dict.LoginUrl = data.loginUrl;
    if (data.reasoningEffort !== undefined) {
      dict.ReasoningEffort = data.reasoningEffort;
    }
    if (data.requestedReasoningEffort !== undefined) {
      dict.RequestedReasoningEffort = data.requestedReasoningEffort;
    }
    if (data.supportedReasoningEfforts !== undefined) {
      dict.SupportedReasoningEfforts = data.supportedReasoningEfforts;
    }
    if (data.activeModelLocator !== undefined) {
      dict.ActiveModelLocator = data.activeModelLocator;
    }
    if (data.availableModelLocators !== undefined) {
      dict.AvailableModelLocators = data.availableModelLocators;
    }
    if (data.requestedModelLocator !== undefined) {
      dict.RequestedModelLocator = data.requestedModelLocator;
    }
    if (data.effortResetNote !== undefined) {
      dict.EffortResetNote = data.effortResetNote;
    }
    return MessageLoader.applyTemplate(text, dict);
  }
}
