import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { ChatResponseProgressDTO } from "~/client/modules/chat/app/dtos/ChatResponseProgressDTO";
import type { ChatProgressListener } from "~/client/modules/chat/app/repositories/ChatRepository";
import { createChatProgressBatcher } from "~/client/modules/chat/app/utils/createChatProgressBatcher";
import type { SessionService } from "~/client/modules/identity/app/services/SessionService";
import { container } from "~/client/shared/container";
import { type ApiError, clientError } from "~/client/shared/error/ApiError";
import type {
  AiModelSelectionResponseDTO,
  ChatMessageDTO,
  WebChatDTO,
} from "~/contracts/http/chat/chat";
import {
  ReasoningEffort,
  type ReasoningEffort as ReasoningEffortType,
} from "~/domain/chat/reasoning-effort";

export type ChatErrorCode = "loading" | "sending" | "unanswered" | "microphone";

type ChatSend = (
  onProgress: ChatProgressListener,
) => Promise<WebChatDTO | undefined>;

const answerPollMs = 3_000;
const answerDeadlineMs = 300_000;

export type ChatService = {
  chatMessages: ChatMessageDTO[];
  chatInput: string;
  chatResponseProgress?: ChatResponseProgressDTO;
  currentModel?: AiModelSelectionResponseDTO;
  availableModels: AiModelSelectionResponseDTO[];
  reasoningEffort: ReasoningEffortType;
  supportedReasoningEfforts: ReasoningEffortType[];
  chatError?: ChatErrorCode | ApiError;

  isChatBootstrapping: boolean;
  isChatSubmitting: boolean;

  canSendChatInput: boolean;

  setChatInput: (input: string) => void;
  clearChatError: () => void;
  bootstrapChat: () => Promise<
    "ok" | "error" | "unauthorized" | "not_registered"
  >;
  refreshChat: () => Promise<void>;
  sendChatInput: () => Promise<void>;
  setModel: (model: AiModelSelectionResponseDTO) => Promise<void>;
  setReasoningEffort: (effort: ReasoningEffortType) => Promise<void>;
  sendChatAudio: (blob: Blob, url: string) => Promise<void>;
  sendButtonReply: (buttonReply: string) => Promise<void>;
  resetChat: () => void;
  invalidateChatRequests: () => void;
};

type ChatState = ChatService &
  Pick<SessionService, "currentUser" | "bootstrapSession">;

export const createChatService: StateCreator<ChatState, [], [], ChatService> = (
  set,
  get,
) => {
  let generation = 0;
  let isRefreshing = false;
  const progressBatchers = new Set<
    ReturnType<typeof createChatProgressBatcher>
  >();
  function applyChatSnapshot(chat: WebChatDTO) {
    set({
      chatMessages: chat.messages,
      chatResponseProgress: undefined,
      currentModel: chat.currentModel,
      availableModels: chat.availableModels,
      reasoningEffort: chat.reasoningEffort,
      supportedReasoningEfforts: chat.supportedReasoningEfforts,
    });
  }
  async function submitMessage(
    optimistic: ChatMessageDTO,
    send: ChatSend,
    draft?: string,
  ) {
    const { isChatSubmitting, invalidateChatRequests } = get();
    if (isChatSubmitting) return;
    invalidateChatRequests();
    const request = generation;
    set((state) => ({
      chatMessages: [...state.chatMessages, optimistic],
      chatResponseProgress: undefined,
      chatError: undefined,
      isChatSubmitting: true,
    }));
    const progressBatcher = createChatProgressBatcher(
      (chatResponseProgress) => {
        if (request === generation) set({ chatResponseProgress });
      },
    );
    progressBatchers.add(progressBatcher);
    try {
      const deadline = Date.now() + answerDeadlineMs;
      let chat = await send(progressBatcher.push);
      let sent = findSentMessage(chat, optimistic.id);
      while (!chat || !sent?.isAnswered) {
        if (request !== generation) return;
        if (Date.now() >= deadline) {
          if (chat && sent) applyChatSnapshot(chat);
          set({ chatError: "unanswered", chatResponseProgress: undefined });
          return;
        }
        await wait(answerPollMs);
        if (request !== generation) return;
        chat = await readReachableChat();
        if (request !== generation) return;
        if (chat && !findSentMessage(chat, optimistic.id)) {
          chat = await send(progressBatcher.push);
        }
        sent = findSentMessage(chat, optimistic.id);
      }
      if (request !== generation) return;
      applyChatSnapshot(chat);
    } catch (error) {
      if (request !== generation) return;
      set((state) => {
        const failed: Partial<ChatService> = {
          chatMessages: state.chatMessages.filter(
            (message) => message.id !== optimistic.id,
          ),
          chatError: clientError(error, "sending"),
          chatResponseProgress: undefined,
        };
        if (draft !== undefined && state.chatInput === "") {
          failed.chatInput = draft;
        }
        return failed;
      });
    } finally {
      progressBatcher.cancel();
      progressBatchers.delete(progressBatcher);
      if (request === generation) set({ isChatSubmitting: false });
    }
  }
  async function sendTextMessage(
    text: string,
    type: "text" | "command",
    draft?: string,
  ) {
    const clientMessageId = crypto.randomUUID();
    await submitMessage(
      {
        id: clientMessageId,
        type,
        userType: "user",
        text,
        createdAt: new Date().toISOString(),
      },
      (onProgress) =>
        container
          .get("ChatRepository")
          .sendMessage({ text, clientMessageId }, onProgress),
      draft,
    );
  }
  return {
    chatMessages: [],
    chatInput: "",
    chatResponseProgress: undefined,
    currentModel: undefined,
    availableModels: [],
    reasoningEffort: ReasoningEffort.Off,
    supportedReasoningEfforts: [ReasoningEffort.Off],
    chatError: undefined,
    isChatBootstrapping: true,
    isChatSubmitting: false,
    ...compute("chat", get, (state) => ({
      canSendChatInput:
        state.chatInput.trim().length > 0 && !state.isChatSubmitting,
    })),
    setChatInput(input) {
      set({ chatInput: input });
    },
    clearChatError() {
      set({ chatError: undefined });
    },
    async bootstrapChat() {
      const { isChatSubmitting } = get();
      if (isChatSubmitting) return "ok";
      const request = ++generation;
      set({ isChatBootstrapping: true, chatError: undefined });
      try {
        const { bootstrapSession } = get();
        const result = await bootstrapSession();
        if (result === "not_registered") return result;
        if (request !== generation) return "error";
        if (result !== "ok") return result;
        const chat = await container.get("ChatRepository").getChat();
        if (request !== generation) return "error";
        applyChatSnapshot(chat);
        return "ok";
      } catch (error) {
        if (request === generation)
          set({ chatError: clientError(error, "loading") });
        return "error";
      } finally {
        if (request === generation) set({ isChatBootstrapping: false });
      }
    },
    async refreshChat() {
      const { currentUser, isChatSubmitting, chatMessages } = get();
      if (!currentUser || isChatSubmitting || isRefreshing) return;
      const request = generation;
      function isCurrentRefresh() {
        const current = get();
        return (
          request === generation &&
          current.currentUser === currentUser &&
          current.chatMessages === chatMessages &&
          !current.isChatSubmitting
        );
      }
      isRefreshing = true;
      try {
        const chat = await container.get("ChatRepository").getChat();
        if (isCurrentRefresh()) applyChatSnapshot(chat);
      } catch (error) {
        if (isCurrentRefresh())
          set({ chatError: clientError(error, "loading") });
      } finally {
        if (request === generation) isRefreshing = false;
      }
    },
    async sendChatInput() {
      const { chatInput, isChatSubmitting } = get();
      const text = chatInput.trim();
      if (!text || isChatSubmitting) return;
      set({ chatInput: "" });
      await sendTextMessage(text, "text", text);
    },
    async setModel(model) {
      const { currentModel, isChatSubmitting } = get();
      if (
        (currentModel?.provider === model.provider &&
          currentModel.model === model.model) ||
        isChatSubmitting
      ) {
        return;
      }
      await sendTextMessage(`/model ${model.model}`, "command");
    },
    async setReasoningEffort(effort) {
      const { reasoningEffort, isChatSubmitting } = get();
      if (effort === reasoningEffort || isChatSubmitting) return;
      await sendTextMessage(`/effort ${effort}`, "command");
    },
    async sendButtonReply(buttonReply) {
      const clientMessageId = crypto.randomUUID();
      await submitMessage(
        {
          id: clientMessageId,
          type: "interactive",
          userType: "user",
          buttonReply,
          createdAt: new Date().toISOString(),
        },
        (onProgress) =>
          container
            .get("ChatRepository")
            .sendMessage({ buttonReply, clientMessageId }, onProgress),
      );
    },
    async sendChatAudio(blob, url) {
      const clientMessageId = crypto.randomUUID();
      await submitMessage(
        {
          id: clientMessageId,
          type: "audio",
          userType: "user",
          mediaUrl: url,
          mimeType: blob.type,
          createdAt: new Date().toISOString(),
        },
        (onProgress) =>
          container
            .get("ChatRepository")
            .sendAudio(
              { blob, mimeType: blob.type, clientMessageId },
              onProgress,
            ),
      );
    },
    invalidateChatRequests() {
      generation += 1;
      isRefreshing = false;
      for (const batcher of progressBatchers) batcher.cancel();
      progressBatchers.clear();
      set({ isChatBootstrapping: false });
    },
    resetChat() {
      const { invalidateChatRequests } = get();
      invalidateChatRequests();
      set({
        chatMessages: [],
        chatInput: "",
        chatResponseProgress: undefined,
        currentModel: undefined,
        availableModels: [],
        reasoningEffort: ReasoningEffort.Off,
        supportedReasoningEfforts: [ReasoningEffort.Off],
        chatError: undefined,
        isChatBootstrapping: false,
        isChatSubmitting: false,
      });
    },
  };
};

function findSentMessage(
  chat: WebChatDTO | undefined,
  clientMessageId: string,
) {
  return chat?.messages.find(
    (message) => message.clientMessageId === clientMessageId,
  );
}

async function readReachableChat(): Promise<WebChatDTO | undefined> {
  try {
    return await container.get("ChatRepository").getChat();
  } catch {
    return undefined;
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
