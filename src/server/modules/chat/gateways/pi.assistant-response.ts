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
    const conflictingContent = response.content.some(
      (content) => content.type !== "thinking" && content !== replyCall,
    );
    if (conflictingContent) {
      throw new ValidationException(
        "An options reply cannot include text or other tool calls",
      );
    }
    const reply = ReplyWithOptionsToolDTO.safeParse(replyCall.arguments);
    if (!reply.success) {
      throw new ValidationException(
        "The options reply does not match the expected schema",
      );
    }
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
