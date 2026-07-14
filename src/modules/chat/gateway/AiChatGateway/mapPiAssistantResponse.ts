import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
  ReplyWithOptionsToolDTO,
  replyWithOptionsToolName,
} from "~/modules/chat/entities/dtos/ReplyWithOptionsToolDTO";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import type { AiCompletionResponse } from "~/modules/chat/gateway/AiChatGateway";
import { ValidationException } from "~/shared/errors/DomainErrors";

export function mapPiAssistantResponse(
  response: AssistantMessage,
): Pick<AiCompletionResponse, "content" | "toolCalls"> {
  const text = response.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n\n")
    .trim();
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
    if (text || calls.length > 1) {
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
      content: {
        type: MessageContentType.Button,
        text: reply.data.message,
        options: reply.data.options,
      },
      toolCalls: [],
    };
  }
  return {
    content: text ? { type: MessageContentType.Text, text } : undefined,
    toolCalls: calls.map((call) => ({
      type: MessageContentType.ToolCall,
      callId: call.id,
      name: call.name,
      arguments: call.arguments,
    })),
  };
}
