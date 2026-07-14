import { describe, expect, test } from "vitest";
import { parseChatMessage } from "~/modules/chat/client/services/webChatService";
import { parseWebChatEvent } from "~/modules/chat/client/services/webChatStreamService";
import {
  toChannelMessageResponse,
  toMessageCreatedEvent,
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

  test("persisted message events carry exact identity and sequence", () => {
    const chat = new Chat();
    const message = chat.addAssistantTextMessage("done");
    message.sequence = 7;
    const response = toMessageCreatedEvent(message);
    const wireResponse = JSON.parse(Printable.make(response));

    const event = parseWebChatEvent(wireResponse);

    expect(wireResponse).toMatchObject({
      type: "messageCreated",
      created_at: message.createdAt.toISOString(),
      message: { user_type: "bot" },
    });
    expect(event).toMatchObject({
      type: "messageCreated",
      id: message.id,
      sequence: 7,
      message: { id: message.id, text: "done" },
    });
  });
});
