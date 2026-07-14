import { describe, expect, test } from "vitest";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import type { SendWebMessageDTO } from "~/modules/chat/client/entities/dtos/SendWebMessageDTO";
import type { WebChatClientService } from "~/modules/chat/client/services/webChatService";
import {
  type ChatSlice,
  createChatSlice,
} from "~/modules/chat/client/state/chatSlice";
import type { ChatMessage } from "~/modules/chat/entities/dtos/ChatDTO";

type TestChatState = ChatSlice & {
  stopRecording: (shouldSend: boolean) => void;
};

function createMessage(patch: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    type: "text",
    userType: "bot",
    text: "done",
    createdAt: "2026-07-14T12:00:00.000Z",
    ...patch,
  };
}

function createStore(service: WebChatClientService) {
  return create<TestChatState>()(
    computed((...args) => ({
      ...createChatSlice(service)(...args),
      stopRecording() {},
    })),
  );
}

describe("chatSlice", () => {
  test("replaces the optimistic message with the authoritative send result", async () => {
    let resolveSend: (messages: ChatMessage[]) => void = () => {};
    const sendResult = new Promise<ChatMessage[]>((resolve) => {
      resolveSend = resolve;
    });
    let sentMessage: SendWebMessageDTO | undefined;
    const service: WebChatClientService = {
      async getCurrentUser() {
        return {
          id: crypto.randomUUID(),
          name: "Irwin",
          phoneNumber: "5511999999999",
        };
      },
      async getMessages() {
        return [];
      },
      async sendMessage(dto) {
        sentMessage = dto;
        return sendResult;
      },
      async sendAudio() {
        return [];
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();

    const optimistic = store.getState().chatMessages[0];
    expect(store.getState().isChatSubmitting).toBe(true);
    expect(optimistic).toMatchObject({ text: "Hello", userType: "user" });
    expect(sentMessage).toMatchObject({
      text: "Hello",
      clientMessageId: optimistic?.id,
    });

    const messages = [
      createMessage({
        clientMessageId: optimistic?.id,
        text: "Hello",
        userType: "user",
      }),
      createMessage({ text: "Hello back" }),
    ];
    resolveSend(messages);
    await sending;

    expect(store.getState().chatMessages).toEqual(messages);
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("refreshes a stale chat from the authoritative snapshot", async () => {
    let messages = [createMessage({ text: "before" })];
    const service: WebChatClientService = {
      async getCurrentUser() {
        return {
          id: crypto.randomUUID(),
          name: "Irwin",
          phoneNumber: "5511999999999",
        };
      },
      async getMessages() {
        return messages;
      },
      async sendMessage() {
        return messages;
      },
      async sendAudio() {
        return messages;
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();
    messages = [...messages, createMessage({ text: "after" })];

    await store.getState().refreshChat();

    expect(store.getState().chatMessages).toEqual(messages);
  });
});
