import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { ChatResponseProgressDTO } from "~/modules/chat/client/entities/dtos/ChatResponseProgressDTO";
import {
  WebChatAuthError,
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
import { toAiModelLocator } from "~/modules/chat/utils/AiModelLocator";
import type { CurrentUserDTO } from "~/modules/identity/entities/dtos/IdentityDTO";

export type ChatErrorCode = "loading" | "sending" | "microphone";

export type ChatSlice = {
  currentUser?: CurrentUserDTO;
  chatMessages: ChatMessageDTO[];
  chatInput: string;
  chatResponseProgress?: ChatResponseProgressDTO;
  currentModel?: AiModelSelectionResponseDTO;
  availableModels: AiModelSelectionResponseDTO[];
  reasoningEffort: ReasoningEffortType;
  supportedReasoningEfforts: ReasoningEffortType[];
  chatError?: ChatErrorCode;

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
  sendButtonReply: (buttonReply: string) => Promise<void>;
  logout: () => Promise<void>;
};

type ChatState = ChatSlice & {
  stopRecording: (shouldSend: boolean) => void;
};

export function createChatSlice(
  service: WebChatClientService = webChatService,
): StateCreator<ChatState, [], [], ChatSlice> {
  return (set, get) => {
    let isRefreshing = false;
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
        (chatResponseProgress) => set({ chatResponseProgress }),
      );
      try {
        const chat = await service.sendMessage(
          {
            text,
            clientMessageId: optimistic.id,
          },
          progressBatcher.push,
        );
        progressBatcher.cancel();
        applyChatSnapshot(chat);
      } catch {
        set({ chatError: "sending", chatResponseProgress: undefined });
      } finally {
        progressBatcher.cancel();
        set({ isChatSubmitting: false });
      }
    }
    return {
      currentUser: undefined,
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
        set({ isChatBootstrapping: true, chatError: undefined });
        try {
          const user = await service.getCurrentUser();
          if (!user) {
            set({ chatError: "loading" });
            return "error";
          }
          set({ currentUser: user });
          const chat = await service.getChat();
          applyChatSnapshot(chat);
          return "ok";
        } catch (e) {
          if (e instanceof WebChatAuthError) return e.reason;
          set({ chatError: "loading" });
          return "error";
        } finally {
          set({ isChatBootstrapping: false });
        }
      },
      async refreshChat() {
        const { currentUser, isChatSubmitting } = get();
        if (!currentUser || isChatSubmitting || isRefreshing) return;
        isRefreshing = true;
        try {
          const chat = await service.getChat();
          applyChatSnapshot(chat);
        } catch {
          set({ chatError: "loading" });
        } finally {
          isRefreshing = false;
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
        await sendTextMessage(
          `/model ${toAiModelLocator(model)}`,
          "command",
          false,
        );
      },
      async setReasoningEffort(effort) {
        const { reasoningEffort, isChatSubmitting } = get();
        if (effort === reasoningEffort || isChatSubmitting) return;
        await sendTextMessage(`/effort ${effort}`, "command", false);
      },
      async sendButtonReply(buttonReply) {
        const { isChatSubmitting } = get();
        if (isChatSubmitting) return;
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
          (chatResponseProgress) => set({ chatResponseProgress }),
        );
        try {
          const chat = await service.sendMessage(
            {
              buttonReply,
              clientMessageId: optimistic.id,
            },
            progressBatcher.push,
          );
          progressBatcher.cancel();
          applyChatSnapshot(chat);
        } catch {
          set({ chatError: "sending", chatResponseProgress: undefined });
        } finally {
          progressBatcher.cancel();
          set({ isChatSubmitting: false });
        }
      },
      async logout() {
        await service.logout();
        const { stopRecording } = get();
        stopRecording(false);
        set({
          currentUser: undefined,
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
        });
      },
    };
  };
}

export const chatSlice = createChatSlice();
