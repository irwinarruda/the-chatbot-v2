import { Paths } from "~/infra/paths";
import { ChatTemplateLoader } from "./ChatTemplateLoader";

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
  CompactCompleted: "CompactCompleted",
  CompactUnavailable: "CompactUnavailable",
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
  activeModelId?: string;
  availableModelIds?: string;
  requestedModelId?: string;
  effortResetNote?: string;
}

export class MessageLoader {
  private static readonly templates = new ChatTemplateLoader(
    Paths.templatesDir("messages"),
    "Message template file",
  );

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
      case MessageTemplate.CompactCompleted:
        return "compact-completed-message";
      case MessageTemplate.CompactUnavailable:
        return "compact-unavailable-message";
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
    const parameters = {
      LoginUrl: data?.loginUrl,
      ReasoningEffort: data?.reasoningEffort,
      RequestedReasoningEffort: data?.requestedReasoningEffort,
      SupportedReasoningEfforts: data?.supportedReasoningEfforts,
      ActiveModelId: data?.activeModelId,
      AvailableModelIds: data?.availableModelIds,
      RequestedModelId: data?.requestedModelId,
      EffortResetNote: data?.effortResetNote,
    };
    try {
      return MessageLoader.templates.load(fileName, parameters);
    } catch {
      return MessageLoader.templates.load(
        baseName + MessageLoader.localeToFileSuffix(MessageLocale.PtBr),
        parameters,
      );
    }
  }
}
