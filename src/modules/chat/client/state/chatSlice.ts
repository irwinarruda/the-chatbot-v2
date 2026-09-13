import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { ChatResponseProgressDTO } from "~/modules/chat/client/entities/dtos/ChatResponseProgressDTO";
import {
  type WebChatClientService,
  webChatService,
} from "~/modules/chat/client/services/webChatService";
import { createChatProgressBatcher } from "~/modules/chat/client/state/createChatProgressBatcher";
import type {
  AiModelSelectionResponseDTO,
  ChatMessageDTO,
  WebChatDTO,
} from "~/modules/chat/entities/dtos/ChatDTO";
import {
  ReasoningEffort,
  type ReasoningEffort as ReasoningEffortType,
} from "~/modules/chat/entities/enums/ReasoningEffort";
import type { SessionSlice } from "~/modules/identity/client/state/sessionSlice";
import { type ApiError, clientError } from "~/shared/client/services/ApiClient";

export type ChatErrorCode = "loading" | "sending" | "microphone";

export type ChatSlice = {
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

type ChatState = ChatSlice &
  Pick<SessionSlice, "currentUser" | "bootstrapSession">;

export function createChatSlice(
  service: WebChatClientService = webChatService,
): StateCreator<ChatState, [], [], ChatSlice> {
  return (set, get) => {
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
    async function sendTextMessage(
      text: string,
      type: "text" | "command",
      clearInput: boolean,
    ) {
      const { isChatSubmitting } = get();
      if (!text || isChatSubmitting) return;
      const { invalidateChatRequests } = get();

      invalidateChatRequests();
      const request = generation;
      const submittingState: Partial<ChatSlice> = {
        chatResponseProgress: undefined,
        isChatSubmitting: true,
      };
      if (clearInput) submittingState.chatInput = "";
      set(submittingState);
      const optimistic: ChatMessageDTO = {
        id: crypto.randomUUID(),
        type,
        userType: "user",
        text,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ chatMessages: [...state.chatMessages, optimistic] }));
      const progressBatcher = createChatProgressBatcher(
        (chatResponseProgress) => {
          if (request === generation) set({ chatResponseProgress });
        },
      );
      progressBatchers.add(progressBatcher);
      try {
        const chat = await service.sendMessage(
          {
            text,
            clientMessageId: optimistic.id,
          },
          progressBatcher.push,
        );
        progressBatcher.cancel();
        if (request !== generation) return;
        applyChatSnapshot(chat);
      } catch (error) {
        if (request !== generation) return;
        set({
          chatError: clientError(error, "sending"),
          chatResponseProgress: undefined,
        });
      } finally {
        progressBatcher.cancel();
        progressBatchers.delete(progressBatcher);
        if (request === generation) set({ isChatSubmitting: false });
      }
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
          const chat = await service.getChat();
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
          const chat = await service.getChat();
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
        await sendTextMessage(text, "text", true);
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
        await sendTextMessage(`/model ${model.model}`, "command", false);
      },
      async setReasoningEffort(effort) {
        const { reasoningEffort, isChatSubmitting } = get();
        if (effort === reasoningEffort || isChatSubmitting) return;
        await sendTextMessage(`/effort ${effort}`, "command", false);
      },
      async sendButtonReply(buttonReply) {
        const { isChatSubmitting } = get();
        if (isChatSubmitting) return;
        const { invalidateChatRequests } = get();
        invalidateChatRequests();
        const request = generation;
        set({ chatResponseProgress: undefined, isChatSubmitting: true });
        const optimistic: ChatMessageDTO = {
          id: crypto.randomUUID(),
          type: "interactive",
          userType: "user",
          buttonReply,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ chatMessages: [...state.chatMessages, optimistic] }));
        const progressBatcher = createChatProgressBatcher(
          (chatResponseProgress) => {
            if (request === generation) set({ chatResponseProgress });
          },
        );
        progressBatchers.add(progressBatcher);
        try {
          const chat = await service.sendMessage(
            {
              buttonReply,
              clientMessageId: optimistic.id,
            },
            progressBatcher.push,
          );
          progressBatcher.cancel();
          if (request !== generation) return;
          applyChatSnapshot(chat);
        } catch (error) {
          if (request !== generation) return;
          set({
            chatError: clientError(error, "sending"),
            chatResponseProgress: undefined,
          });
        } finally {
          progressBatcher.cancel();
          progressBatchers.delete(progressBatcher);
          if (request === generation) set({ isChatSubmitting: false });
        }
      },
      async sendChatAudio(blob, url) {
        const { isChatSubmitting, invalidateChatRequests } = get();
        if (isChatSubmitting) return;
        invalidateChatRequests();
        const request = generation;
        const optimistic: ChatMessageDTO = {
          id: crypto.randomUUID(),
          type: "audio",
          userType: "user",
          mediaUrl: url,
          mimeType: blob.type,
          createdAt: new Date().toISOString(),
        };
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
          const chat = await service.sendAudio(
            { blob, mimeType: blob.type, clientMessageId: optimistic.id },
            progressBatcher.push,
          );
          if (request !== generation) return;
          applyChatSnapshot(chat);
        } catch (error) {
          if (request !== generation) return;
          set((state) => ({
            chatMessages: state.chatMessages.filter(
              (message) => message.id !== optimistic.id,
            ),
            chatError: clientError(error, "sending"),
            chatResponseProgress: undefined,
          }));
        } finally {
          progressBatcher.cancel();
          progressBatchers.delete(progressBatcher);
          if (request === generation) set({ isChatSubmitting: false });
        }
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
}

export const chatSlice = createChatSlice();
