import type { Chat } from "~/modules/chat/entities/Chat";
import {
  ChannelMessageResponse,
  ChatMessagesResponse,
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

export function toChatMessagesResponse(chat?: Chat): ChatMessagesResponse {
  return ChatMessagesResponse.parse({
    messages: chat?.getChannelMessages().map(toChannelMessageResponse) ?? [],
  });
}
