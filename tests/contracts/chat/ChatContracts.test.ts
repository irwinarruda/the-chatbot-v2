import { describe, expect, test } from "vitest";
import {
  toChannelMessageResponse,
  toMessageCreatedEvent,
} from "~/modules/chat/contracts/ChatContractMapper";
import { WebChatEvent } from "~/modules/chat/contracts/ChatContracts";
import { Chat } from "~/modules/chat/domain/Chat";
import { ChatChannel } from "~/modules/chat/domain/enums/ChatChannel";

describe("Chat contracts", () => {
  test("real channel message serialization is accepted by the shared schema", () => {
    const chat = new Chat();
    chat.setChannelAddress(ChatChannel.Web, "user@example.com");
    const message = chat.addUserTextMessage(
      "hello",
      "00000000-0000-4000-8000-000000000010",
    );
    message.sequence = 1;

    expect(toChannelMessageResponse(message)).toMatchObject({
      id: message.id,
      clientMessageId: message.channelMessageId,
      text: "hello",
      userType: "user",
    });
  });

  test("persisted message events carry exact identity and sequence", () => {
    const chat = new Chat();
    const message = chat.addAssistantTextMessage("done");
    message.sequence = 7;

    const event = WebChatEvent.parse(toMessageCreatedEvent(message));

    expect(event).toMatchObject({
      type: "messageCreated",
      id: message.id,
      sequence: 7,
      message: { id: message.id, text: "done" },
    });
  });
});
