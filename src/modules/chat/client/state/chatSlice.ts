import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import {
  WebChatAuthError,
  type WebChatClientService,
  webChatService,
} from "~/modules/chat/client/services/webChatService";
import type { ChatMessage } from "~/modules/chat/entities/dtos/ChatDTO";
import type { CurrentUser } from "~/modules/identity/entities/dtos/IdentityDTO";

export type ChatErrorCode = "loading" | "sending" | "microphone";

export type ChatSlice = {
  currentUser?: CurrentUser;
  chatMessages: ChatMessage[];
  chatInput: string;
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
    return {
      currentUser: undefined,
      chatMessages: [],
      chatInput: "",
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
          const messages = await service.getMessages();
          set({ chatMessages: messages });
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
        const { currentUser } = get();
        if (!currentUser || isRefreshing) return;
        isRefreshing = true;
        try {
          const messages = await service.getMessages();
          set({ chatMessages: messages });
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
        set({ isChatSubmitting: true, chatInput: "" });
        const optimistic: ChatMessage = {
          id: crypto.randomUUID(),
          type: "text",
          userType: "user",
          text,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ chatMessages: [...state.chatMessages, optimistic] }));
        try {
          const messages = await service.sendMessage({
            text,
            clientMessageId: optimistic.id,
          });
          set({ chatMessages: messages });
        } catch {
          set({ chatError: "sending" });
        } finally {
          set({ isChatSubmitting: false });
        }
      },
      async sendButtonReply(buttonReply) {
        const { isChatSubmitting } = get();
        if (isChatSubmitting) return;
        set({ isChatSubmitting: true });
        const optimistic: ChatMessage = {
          id: crypto.randomUUID(),
          type: "interactive",
          userType: "user",
          buttonReply,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ chatMessages: [...state.chatMessages, optimistic] }));
        try {
          const messages = await service.sendMessage({
            buttonReply,
            clientMessageId: optimistic.id,
          });
          set({ chatMessages: messages });
        } catch {
          set({ chatError: "sending" });
        } finally {
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
          chatError: undefined,
          isChatBootstrapping: true,
          isChatSubmitting: false,
        });
      },
    };
  };
}

export const chatSlice = createChatSlice();
