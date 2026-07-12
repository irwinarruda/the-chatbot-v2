import { MessageContentType } from "~/shared/entities/enums/MessageContentType";
import type { MessageContent } from "~/shared/entities/Message";

export type AssistantTextContent = Extract<
  MessageContent,
  | { type: typeof MessageContentType.Text }
  | { type: typeof MessageContentType.Button }
>;

export class AssistantTextParser {
  static parse(raw: string): AssistantTextContent {
    if (!raw) return { type: MessageContentType.Text, text: "" };
    const buttonMatch = raw.match(/\[Button\]\s*\[(?<btns>[^\]]+)\]/i);
    const text = raw
      .replace(/\[Button\]\s*\[[^\]]*\]/gi, "")
      .replace(/\[Button\]/gi, "")
      .replace(/\[Text\]/gi, "")
      .replace(/ {2,}/g, " ")
      .trim();
    if (buttonMatch?.groups?.btns) {
      const options = buttonMatch.groups.btns
        .split(";")
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
        .slice(0, 3);
      if (options.length > 0) {
        return { type: MessageContentType.Button, text, options };
      }
    }
    return { type: MessageContentType.Text, text };
  }
}
