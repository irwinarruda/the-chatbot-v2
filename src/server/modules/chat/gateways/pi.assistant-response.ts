import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
  ReplyWithOptionsToolDTO,
  replyWithOptionsToolName,
} from "~/contracts/tools/chat/reply-with-options";
import { MessageContentType } from "~/domain/chat/message-content-type";
import type { AiCompletionResponseDTO } from "./ai-chat";

export function mapPiAssistantResponse(
  response: AssistantMessage,
): Pick<AiCompletionResponseDTO, "items"> {
  const calls = response.content.filter(
    (content) => content.type === "toolCall",
  );
  let reply: ReplyWithOptionsToolDTO | undefined;
  if (calls.length === 1 && calls[0].name === replyWithOptionsToolName) {
    reply = ReplyWithOptionsToolDTO.safeParse(calls[0].arguments).data;
  }
  if (reply) {
    const { message, options } = reply;
    const questionLines = new Set(
      message
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );
    const reasoning = response.content.flatMap(
      (content): AiCompletionResponseDTO["items"] =>
        content.type === "thinking"
          ? [
              {
                type: MessageContentType.Reasoning,
                text: content.thinking,
                thinkingSignature: content.thinkingSignature,
                redacted: content.redacted,
              },
            ]
          : [],
    );
    const leadingTexts = response.content.flatMap(
      (content): AiCompletionResponseDTO["items"] => {
        if (content.type !== "text") return [];
        const text = content.text
          .split("\n")
          .filter((line) => !questionLines.has(line.trim()))
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (!text) return [];
        const isUnchanged = text === content.text.trim();
        return [
          {
            type: MessageContentType.Text,
            text,
            textSignature: isUnchanged ? content.textSignature : undefined,
          },
        ];
      },
    );
    return {
      items: [
        ...reasoning,
        ...leadingTexts,
        {
          type: MessageContentType.Button,
          text: message,
          options,
        },
      ],
    };
  }
  return {
    items: response.content.map((content) => {
      if (content.type === "thinking") {
        return {
          type: MessageContentType.Reasoning,
          text: content.thinking,
          thinkingSignature: content.thinkingSignature,
          redacted: content.redacted,
        };
      }
      if (content.type === "toolCall") {
        return {
          type: MessageContentType.ToolCall,
          callId: content.id,
          name: content.name,
          arguments: content.arguments,
          thoughtSignature: content.thoughtSignature,
        };
      }
      return {
        type: MessageContentType.Text,
        text: content.text,
        textSignature: content.textSignature,
      };
    }),
  };
}
