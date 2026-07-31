import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import { replyWithOptionsToolName } from "~/modules/chat/entities/dtos/ReplyWithOptionsToolDTO";
import { MessageContentType } from "~/modules/chat/entities/enums/MessageContentType";
import type { AiCompletionProgressDTO } from "~/modules/chat/gateway/AiChatGateway";

export function mapPiAssistantProgress(
  event: AssistantMessageEvent,
): AiCompletionProgressDTO | undefined {
  if (event.type === "thinking_delta") {
    return {
      type: "reasoningDelta",
      contentIndex: event.contentIndex,
      delta: event.delta,
    };
  }
  if (
    event.type !== "toolcall_end" ||
    event.toolCall.name === replyWithOptionsToolName
  ) {
    return undefined;
  }
  return {
    type: "toolCall",
    contentIndex: event.contentIndex,
    call: {
      type: MessageContentType.ToolCall,
      callId: event.toolCall.id,
      name: event.toolCall.name,
      arguments: event.toolCall.arguments,
      thoughtSignature: event.toolCall.thoughtSignature,
    },
  };
}
