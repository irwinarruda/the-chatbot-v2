import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
  ReplyWithOptionsToolDTO,
  replyWithOptionsToolName,
} from "~/contracts/tools/chat/reply-with-options";
import { MessageContentType } from "~/domain/chat/message-content-type";
import { ValidationException } from "~/domain/shared/domain-errors";
import type { AiCompletionResponseDTO } from "./ai-chat";

export function mapPiAssistantResponse(
  response: AssistantMessage,
): Pick<AiCompletionResponseDTO, "items"> {
  const calls = response.content.filter(
    (content) => content.type === "toolCall",
  );
  const replyCalls = calls.filter(
    (call) => call.name === replyWithOptionsToolName,
  );
  if (replyCalls.length > 1) {
    throw new ValidationException(
      "The AI returned more than one options reply",
    );
  }
  const replyCall = replyCalls[0];
  if (replyCall) {
    if (calls.length > 1) {
      throw new ValidationException(
        "An options reply cannot include other tool calls",
      );
    }
    const reply = ReplyWithOptionsToolDTO.safeParse(replyCall.arguments);
    if (!reply.success) {
      throw new ValidationException(
        "The options reply does not match the expected schema",
      );
    }
    const questionLines = new Set(
      reply.data.message
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
          text: reply.data.message,
          options: reply.data.options,
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
