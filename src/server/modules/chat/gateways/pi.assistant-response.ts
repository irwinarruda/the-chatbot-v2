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
    const leadingText = response.content
      .flatMap((content) =>
        content.type === "text" ? [content.text.trim()] : [],
      )
      .filter((text) => text && !reply.data.message.includes(text))
      .join("\n\n");
    return {
      items: [
        ...response.content
          .filter((content) => content.type === "thinking")
          .map((content): AiCompletionResponseDTO["items"][number] => ({
            type: MessageContentType.Reasoning,
            text: content.thinking,
            thinkingSignature: content.thinkingSignature,
            redacted: content.redacted,
          })),
        {
          type: MessageContentType.Button,
          text: leadingText
            ? `${leadingText}\n\n${reply.data.message}`
            : reply.data.message,
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
