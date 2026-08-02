import { afterEach, describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import type { SendWebMessageDTO } from "~/modules/chat/client/entities/dtos/SendWebMessageDTO";
import type { WebChatClientService } from "~/modules/chat/client/services/webChatService";
import {
  type ChatSlice,
  createChatSlice,
} from "~/modules/chat/client/state/chatSlice";
import type {
  ChatMessageDTO,
  WebChatDTO,
} from "~/modules/chat/entities/dtos/ChatDTO";
import { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";

type TestChatState = ChatSlice & {
  stopRecording: (shouldSend: boolean) => void;
};

function createMessage(patch: Partial<ChatMessageDTO> = {}): ChatMessageDTO {
  return {
    id: crypto.randomUUID(),
    type: "text",
    userType: "bot",
    text: "done",
    createdAt: "2026-07-14T12:00:00.000Z",
    ...patch,
  };
}

function createChat(
  messages: ChatMessageDTO[],
  reasoningEffort: ReasoningEffort = ReasoningEffort.Off,
): WebChatDTO {
  return {
    messages,
    currentModel: {
      provider: "openai-codex",
      model: "gpt-5.6-sol",
    },
    availableModels: [
      { provider: "openai-codex", model: "gpt-5.6-sol" },
      { provider: "zai-coding-cn", model: "glm-5.2" },
    ],
    reasoningEffort,
    supportedReasoningEfforts: [
      ReasoningEffort.Off,
      ReasoningEffort.Low,
      ReasoningEffort.High,
    ],
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
  afterEach(() => vi.useRealTimers());

  test("replaces the optimistic message with the authoritative send result", async () => {
    let resolveSend: (chat: WebChatDTO) => void = () => {};
    const sendResult = new Promise<WebChatDTO>((resolve) => {
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
      async getChat() {
        return createChat([]);
      },
      async sendMessage(dto) {
        sentMessage = dto;
        return sendResult;
      },
      async sendAudio() {
        return createChat([]);
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
    resolveSend(createChat(messages));
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
      async getChat() {
        return createChat(messages);
      },
      async sendMessage() {
        return createChat(messages);
      },
      async sendAudio() {
        return createChat(messages);
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();
    messages = [...messages, createMessage({ text: "after" })];

    await store.getState().refreshChat();

    expect(store.getState().chatMessages).toEqual(messages);
  });

  test("keeps the next draft editable while the assistant is responding", async () => {
    let resolveSend: (chat: WebChatDTO) => void = () => {};
    const sendResult = new Promise<WebChatDTO>((resolve) => {
      resolveSend = resolve;
    });
    const service: WebChatClientService = {
      async getCurrentUser() {
        return {
          id: crypto.randomUUID(),
          name: "Irwin",
          phoneNumber: "5511999999999",
        };
      },
      async getChat() {
        return createChat([]);
      },
      async sendMessage() {
        return sendResult;
      },
      async sendAudio() {
        return createChat([]);
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();
    store.getState().setChatInput("First message");

    const sending = store.getState().sendChatInput();
    store.getState().setChatInput("My next thought");

    expect(store.getState().chatInput).toBe("My next thought");
    expect(store.getState().canSendChatInput).toBe(false);

    resolveSend(createChat([createMessage({ text: "Answer" })]));
    await sending;

    expect(store.getState().chatInput).toBe("My next thought");
    expect(store.getState().canSendChatInput).toBe(true);
  });

  test("reduces live reasoning and tool events until the snapshot replaces them", async () => {
    vi.useFakeTimers();
    let onProgress:
      | Parameters<WebChatClientService["sendMessage"]>[1]
      | undefined;
    let resolveSend: (chat: WebChatDTO) => void = () => {};
    const sendResult = new Promise<WebChatDTO>((resolve) => {
      resolveSend = resolve;
    });
    const service: WebChatClientService = {
      async getCurrentUser() {
        return {
          id: crypto.randomUUID(),
          name: "Irwin",
          phoneNumber: "5511999999999",
        };
      },
      async getChat() {
        return createChat([]);
      },
      async sendMessage(_dto, listener) {
        onProgress = listener;
        return sendResult;
      },
      async sendAudio() {
        return createChat([]);
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();
    store.getState().setChatInput("Check my todos");

    const sending = store.getState().sendChatInput();
    onProgress?.({
      type: "reasoningDelta",
      round: 1,
      contentIndex: 0,
      delta: "Inspecting ",
    });
    onProgress?.({
      type: "reasoningDelta",
      round: 1,
      contentIndex: 0,
      delta: "todos",
    });
    onProgress?.({
      type: "toolCall",
      round: 1,
      contentIndex: 1,
      callId: "call-1",
      name: "list_todos",
      arguments: { status: "Pending" },
    });
    await vi.advanceTimersByTimeAsync(16);

    expect(store.getState().chatResponseProgress).toEqual({
      rounds: [
        {
          round: 1,
          reasoning: [{ contentIndex: 0, text: "Inspecting todos" }],
          tools: [
            {
              contentIndex: 1,
              callId: "call-1",
              name: "list_todos",
              arguments: { status: "Pending" },
            },
          ],
        },
      ],
    });

    onProgress?.({
      type: "toolResult",
      round: 1,
      callId: "call-1",
      name: "list_todos",
      outcome: {
        status: "succeeded",
        data: { count: 2 },
      },
    });
    await vi.advanceTimersByTimeAsync(16);
    expect(
      store.getState().chatResponseProgress?.rounds[0]?.tools[0]?.outcome,
    ).toEqual({ status: "succeeded", data: { count: 2 } });

    const messages = [createMessage({ text: "You have two pending todos." })];
    resolveSend(createChat(messages));
    await sending;

    expect(store.getState().chatMessages).toEqual(messages);
    expect(store.getState().chatResponseProgress).toBeUndefined();
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("effort selector sends the same durable slash command", async () => {
    let sentMessage: SendWebMessageDTO | undefined;
    const commandHistory = [
      createMessage({
        type: "command",
        userType: "user",
        text: "/effort high",
      }),
      createMessage({ text: "Esforço de raciocínio definido como high." }),
    ];
    const service: WebChatClientService = {
      async getCurrentUser() {
        return {
          id: crypto.randomUUID(),
          name: "Irwin",
          phoneNumber: "5511999999999",
        };
      },
      async getChat() {
        return createChat([]);
      },
      async sendMessage(dto) {
        sentMessage = dto;
        return createChat(commandHistory, ReasoningEffort.High);
      },
      async sendAudio() {
        return createChat([]);
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();

    await store.getState().setReasoningEffort(ReasoningEffort.High);

    expect(sentMessage).toMatchObject({ text: "/effort high" });
    expect(store.getState().reasoningEffort).toBe(ReasoningEffort.High);
    expect(store.getState().chatMessages).toEqual(commandHistory);
  });

  test("model selector sends the same durable slash command", async () => {
    let sentMessage: SendWebMessageDTO | undefined;
    const selectedModel = {
      provider: "zai-coding-cn",
      model: "glm-5.2",
    };
    const service: WebChatClientService = {
      async getCurrentUser() {
        return {
          id: crypto.randomUUID(),
          name: "Irwin",
          phoneNumber: "5511999999999",
        };
      },
      async getChat() {
        return createChat([]);
      },
      async sendMessage(dto) {
        sentMessage = dto;
        return {
          ...createChat([]),
          currentModel: selectedModel,
        };
      },
      async sendAudio() {
        return createChat([]);
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();

    await store.getState().setModel(selectedModel);

    expect(sentMessage).toMatchObject({
      text: "/model zai-coding-cn/glm-5.2",
    });
    expect(store.getState().currentModel).toEqual(selectedModel);
  });
});
