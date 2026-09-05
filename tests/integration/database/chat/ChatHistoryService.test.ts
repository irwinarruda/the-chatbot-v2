import { beforeEach, describe, expect, test } from "vitest";
import { ZodError } from "zod";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";
import { Message } from "~/modules/chat/entities/Message";
import { ChatHistoryService } from "~/modules/chat/services/ChatHistoryService";
import { orquestrator } from "~/tests/orquestrator";

async function createHistory() {
  const user = await orquestrator.createUser();
  const history = new ChatHistoryService(orquestrator.database);
  const messaging = orquestrator.messagingService;
  const chat = await messaging.receiveWebMessage(
    user.email ?? "history@example.com",
    {
      text: "Source message",
      clientMessageId: crypto.randomUUID(),
    },
  );
  if (!chat) throw new Error("The source chat was not created");
  return {
    user,
    history,
    messaging,
    chat,
    message: chat.messages[0],
    generation: chat.generations[0],
  };
}

describe("ChatHistoryService", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("source lookups preserve deleted-chat history and enforce user ownership", async () => {
    const { user, history, messaging, chat, message } = await createHistory();
    const otherUser = await orquestrator.createUser();
    await messaging.deleteChat(chat.getChannelAddress());

    const messages = await history.getMessagesByIds(user.id, [message.id]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toBeInstanceOf(Message);
    expect(messages[0].toJSON()).toEqual(message.toJSON());
    await expect(
      history.getMessagesByIds(otherUser.id, [message.id]),
    ).resolves.toEqual([]);
    await expect(history.getMessagesByIds(user.id, [])).resolves.toEqual([]);
  });

  test("restores persisted usage and provider diagnostics without losing their contents", async () => {
    const { messaging, chat, generation } = await createHistory();
    const usage = {
      input: 12,
      output: 3,
      cacheRead: 2,
      cacheWrite: 0,
      totalTokens: 17,
      cost: {
        input: 0.1,
        output: 0.2,
        cacheRead: 0.01,
        cacheWrite: 0,
        total: 0.31,
      },
    };
    const diagnostics = [{ providerDetail: { nested: ["kept", 7] } }];
    const { database } = orquestrator;
    await database.sql`
      UPDATE ai_generations SET usage = ${database.json(usage)}, diagnostics = ${database.json(diagnostics)}
      WHERE id = ${generation.id}
    `;

    const restored = await messaging.getChatByChannelAddress(
      chat.getChannelAddress(),
      ChatChannel.Web,
    );

    expect(restored?.generations[0]?.usage).toEqual(usage);
    expect(restored?.generations[0]?.diagnostics).toEqual(diagnostics);
    expect(restored?.messages[0]).toBeInstanceOf(Message);
  });

  test.each([
    { field: "usage", value: { input: "not a number" } },
    { field: "diagnostics", value: { entries: [] } },
  ])(
    "rejects malformed persisted $field at restoration",
    async ({ field, value }) => {
      const { messaging, chat, generation } = await createHistory();
      const { database } = orquestrator;
      await database.sql`
      UPDATE ai_generations SET ${database.sql(field)} = ${database.json(value)}
      WHERE id = ${generation.id}
    `;

      await expect(
        messaging.getChatByChannelAddress(
          chat.getChannelAddress(),
          ChatChannel.Web,
        ),
      ).rejects.toThrow(ZodError);
    },
  );

  test("rejects malformed persisted conversation memory", async () => {
    const { messaging, chat } = await createHistory();
    const { database } = orquestrator;
    await database.sql`
      UPDATE chats SET conversation_summary = ${database.json({
        userProfile: "not an array",
        durableFacts: [],
        compactedThroughSequence: 1,
      })}
      WHERE id = ${chat.id}
    `;

    await expect(
      messaging.getChatByChannelAddress(
        chat.getChannelAddress(),
        ChatChannel.Web,
      ),
    ).rejects.toThrow(ZodError);
  });
});
