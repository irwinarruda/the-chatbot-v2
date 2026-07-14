import { describe, expect, test } from "vitest";
import {
  parseChatMessage,
  parseChatMessages,
} from "~/modules/chat/client/services/webChatService";
import {
  toChannelMessageResponse,
  toChatMessagesResponse,
} from "~/modules/chat/contracts/ChatContractMapper";
import { Chat } from "~/modules/chat/entities/Chat";
import { SendWebMessageRequest } from "~/modules/chat/entities/dtos/ChatDTO";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { Printable } from "~/shared/http/utils/Printable";

describe("Chat contracts", () => {
  test("serialized API messages are mapped to the client contract", () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.Web, "user@example.com");
    const message = chat.addUserTextMessage(
      "hello",
      "legacy-provider-message-id",
    );
    message.sequence = 1;
    const response = toChannelMessageResponse(message);
    const wireResponse = JSON.parse(Printable.make(response));

    expect(wireResponse).toMatchObject({
      client_message_id: message.channelMessageId,
      user_type: "user",
    });
    expect(parseChatMessage(wireResponse)).toMatchObject({
      id: message.id,
      clientMessageId: message.channelMessageId,
      text: "hello",
      userType: "user",
    });
  });

  test("web message requests still require UUID client correlation", () => {
    const result = SendWebMessageRequest.safeParse({
      text: "hello",
      clientMessageId: "legacy-provider-message-id",
    });

    expect(result.success).toBe(false);
  });

  test("persisted messages round trip through the authoritative snapshot", () => {
    const chat = new Chat();
    const message = chat.addAssistantTextMessage("done");
    message.sequence = 7;
    const response = toChatMessagesResponse(chat);
    const wireResponse = JSON.parse(Printable.make(response));

    const messages = parseChatMessages(wireResponse);

    expect(wireResponse).toMatchObject({
      messages: [{ id: message.id, user_type: "bot" }],
    });
    expect(messages).toEqual([
      expect.objectContaining({ id: message.id, text: "done" }),
    ]);
  });
});
