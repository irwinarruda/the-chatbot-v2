import { afterEach, describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import type { SendWebMessageDTO } from "~/client/modules/chat/app/dtos/SendWebMessageDTO";
import type {
  ChatProgressListener,
  ChatRepository,
} from "~/client/modules/chat/app/repositories/ChatRepository";
import {
  type ChatService,
  createChatService,
} from "~/client/modules/chat/app/services/ChatService";
import type { apiSessionRepository } from "~/client/modules/identity/app/repositories/ApiSessionRepository";
import {
  createSessionService,
  type SessionService,
} from "~/client/modules/identity/app/services/SessionService";
import { container } from "~/client/shared/container";
import { ApiError } from "~/client/shared/error/ApiError";
import type { ChatMessageDTO, WebChatDTO } from "~/contracts/http/chat/chat";
import { ReasoningEffort } from "~/domain/chat/reasoning-effort";
import { createDeferred } from "~/tests/support/create-deferred";

type TestChatState = ChatService & SessionService;

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

function createAnsweredChat(
  dto: { clientMessageId: string },
  replies: ChatMessageDTO[] = [createMessage()],
  reasoningEffort: ReasoningEffort = ReasoningEffort.Off,
): WebChatDTO {
  return createChat(
    [
      createMessage({
        clientMessageId: dto.clientMessageId,
        userType: "user",
        isAnswered: true,
      }),
      ...replies,
    ],
    reasoningEffort,
  );
}

function createStore(
  service: ChatRepository &
    Pick<typeof apiSessionRepository, "getCurrentUser" | "logout">,
) {
  container.register("ChatRepository", service);
  container.register("SessionRepository", {
    hasWebAccess: async () => true,
    getCurrentUser: service.getCurrentUser,
    logout: service.logout,
    cancelPendingRequests() {},
  });
  return create<TestChatState>()(
    computed((...args) => ({
      ...createChatService(...args),
      ...createSessionService(() => args[1]().resetChat())(...args),
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
    const service: ChatRepository &
      Pick<typeof apiSessionRepository, "getCurrentUser" | "logout"> = {
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
        isAnswered: true,
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
    const service: ChatRepository &
      Pick<typeof apiSessionRepository, "getCurrentUser" | "logout"> = {
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
    const sending = createDeferred<WebChatDTO>();
    let answered = createChat([]);
    const service: ChatRepository &
      Pick<typeof apiSessionRepository, "getCurrentUser" | "logout"> = {
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
        answered = createAnsweredChat(dto, [createMessage({ text: "Answer" })]);
        return sending.promise;
      },
      async sendAudio() {
        return createChat([]);
      },
      async logout() {},
    };
    const store = createStore(service);
    await store.getState().bootstrapChat();
    store.getState().setChatInput("First message");

    const send = store.getState().sendChatInput();
    store.getState().setChatInput("My next thought");

    expect(store.getState().chatInput).toBe("My next thought");
    expect(store.getState().canSendChatInput).toBe(false);

    sending.resolve(answered);
    await send;

    expect(store.getState().chatInput).toBe("My next thought");
    expect(store.getState().canSendChatInput).toBe(true);
  });

  test("reduces live reasoning and tool events until the snapshot replaces them", async () => {
    vi.useFakeTimers();
    let onProgress: Parameters<ChatRepository["sendMessage"]>[1] | undefined;
    const sendResult = createDeferred<WebChatDTO>();
    let answered = createChat([]);
    const service: ChatRepository &
      Pick<typeof apiSessionRepository, "getCurrentUser" | "logout"> = {
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
      async sendMessage(dto, listener) {
        onProgress = listener;
        answered = createAnsweredChat(dto, [
          createMessage({ text: "You have two pending todos." }),
        ]);
        return sendResult.promise;
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

    sendResult.resolve(answered);
    await sending;

    expect(store.getState().chatMessages).toEqual(answered.messages);
    expect(store.getState().chatResponseProgress).toBeUndefined();
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("effort selector sends the same durable slash command", async () => {
    let sentMessage: SendWebMessageDTO | undefined;
    let commandHistory: ChatMessageDTO[] = [];
    const service: ChatRepository &
      Pick<typeof apiSessionRepository, "getCurrentUser" | "logout"> = {
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
        commandHistory = [
          createMessage({
            clientMessageId: dto.clientMessageId,
            type: "command",
            userType: "user",
            text: "/effort high",
            isAnswered: true,
          }),
          createMessage({ text: "Esforço de raciocínio definido como high." }),
        ];
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
    const service: ChatRepository &
      Pick<typeof apiSessionRepository, "getCurrentUser" | "logout"> = {
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
          ...createAnsweredChat(dto),
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
      text: "/model glm-5.2",
    });
    expect(store.getState().currentModel).toEqual(selectedModel);
  });
});

describe("chat refresh during sending", () => {
  test.each(["during", "after"] as const)(
    "ignores a refresh response arriving %s a newer send",
    async (arrival) => {
      const refreshing = createDeferred<WebChatDTO>();
      const sending = createDeferred<WebChatDTO>();
      const before = createChat([createMessage({ text: "Before" })]);
      let after = createChat([createMessage({ text: "After" })]);
      let chatReads = 0;
      const service: ChatRepository &
        Pick<typeof apiSessionRepository, "getCurrentUser" | "logout"> = {
        async getCurrentUser() {
          return { id: "user", name: "Irwin", phoneNumber: "5511999999999" };
        },
        async getChat() {
          chatReads += 1;
          if (chatReads === 1) return before;
          return refreshing.promise;
        },
        async sendMessage(dto) {
          after = createAnsweredChat(dto, [createMessage({ text: "After" })]);
          return sending.promise;
        },
        async sendAudio() {
          return after;
        },
        async logout() {},
      };
      const store = createStore(service);
      await store.getState().bootstrapChat();
      const refresh = store.getState().refreshChat();
      store.getState().setChatInput("New message");
      const send = store.getState().sendChatInput();
      if (arrival === "after") {
        sending.resolve(after);
        await send;
      }
      const expectedMessages = store.getState().chatMessages;
      refreshing.resolve(before);
      await refresh;
      expect(store.getState().chatMessages).toBe(expectedMessages);
      if (arrival === "during") {
        expect(store.getState().isChatSubmitting).toBe(true);
        sending.resolve(after);
        await send;
      }
      expect(store.getState().chatMessages).toEqual(after.messages);
    },
  );
  test.each(["text", "button", "audio"])(
    "logout invalidates pending %s snapshots and progress",
    async (kind) => {
      vi.useFakeTimers();
      const pending = createDeferred<WebChatDTO>();
      let progress: ChatProgressListener | undefined;
      const service = {
        async getCurrentUser() {
          return { id: "user", name: "User", phoneNumber: "5511999999999" };
        },
        async getChat() {
          return createChat([]);
        },
        async sendMessage(
          _dto: SendWebMessageDTO,
          onProgress?: ChatProgressListener,
        ) {
          progress = onProgress;
          return pending.promise;
        },
        async sendAudio(_dto: unknown, onProgress?: ChatProgressListener) {
          progress = onProgress;
          return pending.promise;
        },
        async logout() {},
      };
      const store = createStore(service);
      await store.getState().bootstrapChat();
      store.getState().setChatInput("Hello");
      let sending: Promise<void>;
      if (kind === "button") sending = store.getState().sendButtonReply("Yes");
      else if (kind === "audio")
        sending = store
          .getState()
          .sendChatAudio(new Blob(["audio"]), "blob:test");
      else sending = store.getState().sendChatInput();
      progress?.({
        type: "reasoningDelta",
        round: 1,
        contentIndex: 0,
        delta: "Old thought",
      });
      await store.getState().logout();
      progress?.({
        type: "reasoningDelta",
        round: 1,
        contentIndex: 0,
        delta: "Late thought",
      });
      await vi.runAllTimersAsync();
      pending.resolve(createChat([createMessage()]));
      await sending;
      expect(store.getState().currentUser).toBeUndefined();
      expect(store.getState().chatMessages).toEqual([]);
      expect(store.getState().chatResponseProgress).toBeUndefined();
      expect(store.getState().isChatSubmitting).toBe(false);
    },
  );
});

describe("chat send recovery", () => {
  afterEach(() => vi.useRealTimers());

  function createRecoveryStore(
    repository: Pick<ChatRepository, "getChat" | "sendMessage">,
  ) {
    return createStore({
      async getCurrentUser() {
        return { id: "user", name: "Irwin", phoneNumber: "5511999999999" };
      },
      async sendAudio() {
        return undefined;
      },
      async logout() {},
      ...repository,
    });
  }

  test("waits for the reply when the connection drops after the message arrived", async () => {
    vi.useFakeTimers();
    const sent: SendWebMessageDTO[] = [];
    let reads = 0;
    const store = createRecoveryStore({
      async sendMessage(dto) {
        sent.push(dto);
        return undefined;
      },
      async getChat() {
        reads += 1;
        const delivered = createMessage({
          clientMessageId: sent[0]?.clientMessageId,
          userType: "user",
          text: "Hello",
          isAnswered: reads > 1,
        });
        if (reads === 1) return createChat([delivered]);
        return createChat([delivered, createMessage({ text: "Hello back" })]);
      },
    });
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    await vi.advanceTimersByTimeAsync(3_000);

    expect(store.getState().isChatSubmitting).toBe(true);
    expect(store.getState().chatError).toBeUndefined();

    await vi.advanceTimersByTimeAsync(3_000);
    await sending;

    expect(sent).toHaveLength(1);
    expect(store.getState().chatMessages.map((m) => m.text)).toEqual([
      "Hello",
      "Hello back",
    ]);
    expect(store.getState().chatError).toBeUndefined();
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("sends the same message again when it never reached the server", async () => {
    vi.useFakeTimers();
    const sent: SendWebMessageDTO[] = [];
    const store = createRecoveryStore({
      async sendMessage(dto) {
        sent.push(dto);
        if (sent.length === 1) return undefined;
        return createAnsweredChat(dto, [createMessage({ text: "Hello back" })]);
      },
      async getChat() {
        return createChat([]);
      },
    });
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    await vi.advanceTimersByTimeAsync(3_000);
    await sending;

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(store.getState().chatMessages.at(-1)?.text).toBe("Hello back");
    expect(store.getState().chatError).toBeUndefined();
  });

  test("keeps waiting while the server cannot be reached", async () => {
    vi.useFakeTimers();
    const sent: SendWebMessageDTO[] = [];
    let reads = 0;
    const store = createRecoveryStore({
      async sendMessage(dto) {
        sent.push(dto);
        return undefined;
      },
      async getChat() {
        reads += 1;
        if (reads < 3) throw new TypeError("Failed to fetch");
        return createAnsweredChat({
          clientMessageId: sent[0]?.clientMessageId ?? "",
        });
      },
    });
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    await vi.advanceTimersByTimeAsync(9_000);
    await sending;

    expect(sent).toHaveLength(1);
    expect(store.getState().chatMessages).toHaveLength(2);
    expect(store.getState().chatError).toBeUndefined();
  });

  test("reports a missing reply at the deadline and keeps the delivered message", async () => {
    vi.useFakeTimers();
    const sent: SendWebMessageDTO[] = [];
    const store = createRecoveryStore({
      async sendMessage(dto) {
        sent.push(dto);
        return undefined;
      },
      async getChat() {
        return createChat([
          createMessage({
            clientMessageId: sent[0]?.clientMessageId,
            userType: "user",
            text: "Hello",
            isAnswered: false,
          }),
        ]);
      },
    });
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    await vi.advanceTimersByTimeAsync(300_000);
    await sending;

    expect(sent).toHaveLength(1);
    expect(store.getState().chatError).toBe("unanswered");
    expect(store.getState().chatMessages).toMatchObject([
      { clientMessageId: sent[0]?.clientMessageId, text: "Hello" },
    ]);
    expect(store.getState().chatInput).toBe("");
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("reads the chat once more when the connection is lost after the deadline", async () => {
    vi.useFakeTimers();
    const sent: SendWebMessageDTO[] = [];
    const store = createRecoveryStore({
      async sendMessage(dto) {
        sent.push(dto);
        await new Promise((resolve) => setTimeout(resolve, 360_000));
        return undefined;
      },
      async getChat() {
        return createAnsweredChat(
          { clientMessageId: sent[0]?.clientMessageId ?? "" },
          [createMessage({ text: "Hello back" })],
        );
      },
    });
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    await vi.advanceTimersByTimeAsync(360_000);
    await sending;

    expect(sent).toHaveLength(1);
    expect(store.getState().chatError).toBeUndefined();
    expect(store.getState().chatMessages.at(-1)?.text).toBe("Hello back");
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("a failure reported after the server saved the message keeps it and does not give the draft back", async () => {
    const failure = new ApiError("The chat response failed.", 500);
    const sent: SendWebMessageDTO[] = [];
    const store = createRecoveryStore({
      async sendMessage(dto) {
        sent.push(dto);
        throw failure;
      },
      async getChat() {
        return createChat([
          createMessage({
            clientMessageId: sent[0]?.clientMessageId,
            userType: "user",
            text: "Hello",
            isAnswered: false,
          }),
        ]);
      },
    });
    store.getState().setChatInput("Hello");

    await store.getState().sendChatInput();

    expect(store.getState().chatMessages).toMatchObject([
      { clientMessageId: sent[0]?.clientMessageId, text: "Hello" },
    ]);
    expect(store.getState().chatInput).toBe("");
    expect(store.getState().chatError).toBe(failure);
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("a failure reported after the reply was saved shows the reply without an error", async () => {
    const sent: SendWebMessageDTO[] = [];
    const store = createRecoveryStore({
      async sendMessage(dto) {
        sent.push(dto);
        throw new ApiError("The chat response failed.", 500);
      },
      async getChat() {
        return createAnsweredChat(
          { clientMessageId: sent[0]?.clientMessageId ?? "" },
          [createMessage({ text: "Hello back" })],
        );
      },
    });
    store.getState().setChatInput("Hello");

    await store.getState().sendChatInput();

    expect(store.getState().chatMessages.at(-1)?.text).toBe("Hello back");
    expect(store.getState().chatInput).toBe("");
    expect(store.getState().chatError).toBeUndefined();
  });

  test("a rejected send removes the optimistic message and gives the draft back", async () => {
    const rejection = new ApiError("Message is not valid", 400);
    const store = createRecoveryStore({
      async sendMessage() {
        throw rejection;
      },
      async getChat() {
        return createChat([]);
      },
    });
    store.getState().setChatInput("Hello");

    await store.getState().sendChatInput();

    expect(store.getState().chatMessages).toEqual([]);
    expect(store.getState().chatInput).toBe("Hello");
    expect(store.getState().chatError).toBe(rejection);
    expect(store.getState().isChatSubmitting).toBe(false);
  });

  test("a rejected send does not replace a newer draft", async () => {
    const sending = createDeferred<WebChatDTO | undefined>();
    const store = createRecoveryStore({
      async sendMessage() {
        return sending.promise;
      },
      async getChat() {
        return createChat([]);
      },
    });
    store.getState().setChatInput("Hello");

    const send = store.getState().sendChatInput();
    store.getState().setChatInput("My next thought");
    sending.reject(new ApiError("Message is not valid", 400));
    await send;

    expect(store.getState().chatInput).toBe("My next thought");
  });

  test("leaving the chat stops waiting for the reply", async () => {
    vi.useFakeTimers();
    let reads = 0;
    const store = createRecoveryStore({
      async sendMessage() {
        return undefined;
      },
      async getChat() {
        reads += 1;
        return createChat([]);
      },
    });
    store.getState().setChatInput("Hello");

    const sending = store.getState().sendChatInput();
    store.getState().resetChat();
    await vi.advanceTimersByTimeAsync(30_000);
    await sending;

    expect(reads).toBe(0);
    expect(store.getState().chatMessages).toEqual([]);
    expect(store.getState().isChatSubmitting).toBe(false);
  });
});
