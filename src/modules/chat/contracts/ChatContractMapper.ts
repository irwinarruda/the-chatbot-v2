import {
  ChannelMessageResponse,
  type WebChatEvent,
} from "~/modules/chat/entities/dtos/ChatDTO";
import type { Message } from "~/modules/chat/entities/Message";

export function toChannelMessageResponse(
  message: Message,
): ChannelMessageResponse {
  return ChannelMessageResponse.parse({
    ...message.toJSON(),
    clientMessageId: message.channelMessageId,
  });
}

export function toMessageCreatedEvent(message: Message): WebChatEvent {
  if (message.sequence === undefined) {
    throw new Error("Cannot stream a message before it is persisted");
  }
  return {
    type: "messageCreated",
    id: message.id,
    sequence: message.sequence,
    createdAt: message.createdAt.toISOString(),
    message: toChannelMessageResponse(message),
  };
}

export function toMessageUpdatedEvent(message: Message): WebChatEvent {
  if (message.sequence === undefined) {
    throw new Error("Cannot stream a message before it is persisted");
  }
  return {
    type: "messageUpdated",
    id: message.id,
    sequence: message.sequence,
    createdAt: message.createdAt.toISOString(),
    message: toChannelMessageResponse(message),
  };
}
