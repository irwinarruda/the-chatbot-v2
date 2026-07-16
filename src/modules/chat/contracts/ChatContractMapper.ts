import type { Chat } from "~/modules/chat/entities/Chat";
import {
  ChannelMessageResponseDTO,
  ChatMessagesResponseDTO,
} from "~/modules/chat/entities/dtos/ChatDTO";
import type { Message } from "~/modules/chat/entities/Message";

export function toChannelMessageResponse(
  message: Message,
): ChannelMessageResponseDTO {
  return ChannelMessageResponseDTO.parse({
    ...message.toJSON(),
    clientMessageId: message.channelMessageId,
  });
}

export function toChatMessagesResponse(chat?: Chat): ChatMessagesResponseDTO {
  return ChatMessagesResponseDTO.parse({
    messages: chat?.getChannelMessages().map(toChannelMessageResponse) ?? [],
  });
}
