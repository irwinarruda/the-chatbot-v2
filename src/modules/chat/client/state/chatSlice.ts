import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import {
  WebChatAuthError,
  webChatService,
} from "~/modules/chat/client/services/webChatService";
import { webChatStreamService } from "~/modules/chat/client/services/webChatStreamService";
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
  isChatStreamConnected: boolean;

  canSendChatInput: boolean;

  setChatInput: (input: string) => void;
  clearChatError: () => void;
  bootstrapChat: () => Promise<
    "ok" | "error" | "unauthorized" | "not_registered"
  >;
  startChatStream: () => void;
  stopChatStream: () => void;
  sendChatInput: () => Promise<void>;
  sendButtonReply: (buttonReply: string) => Promise<void>;
  logout: () => Promise<void>;
};

type ChatState = ChatSlice & {
  stopRecording: (shouldSend: boolean) => void;
};

export const chatSlice: StateCreator<ChatState, [], [], ChatSlice> = (
  set,
  get,
) => {
  let stopStream: (() => void) | undefined;
  return {
    currentUser: undefined,
    chatMessages: [],
    chatInput: "",
    chatError: undefined,
    isChatBootstrapping: true,
    isChatSubmitting: false,
    isChatStreamConnected: false,
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
        const user = await webChatService.getCurrentUser();
        if (!user) {
          set({ chatError: "loading" });
          return "error";
        }
        set({ currentUser: user });
        const messages = await webChatService.getMessages();
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
    startChatStream() {
      const { currentUser } = get();
      if (!currentUser || stopStream) return;
      stopStream = webChatStreamService.subscribe({
        onOpen: () => set({ isChatStreamConnected: true }),
        onClose: () => {
          set({ isChatStreamConnected: false });
        },
        onEvent: (event) => {
          switch (event.type) {
            case "messageCreated":
              set((state) => ({
                chatMessages: state.chatMessages.some(
                  (message) =>
                    message.id === event.message.id ||
                    message.id === event.message.clientMessageId,
                )
                  ? state.chatMessages.map((message) =>
                      message.id === event.message.id ||
                      message.id === event.message.clientMessageId
                        ? event.message
                        : message,
                    )
                  : [...state.chatMessages, event.message],
              }));
              break;
            case "messageUpdated":
              set((state) => ({
                chatMessages: state.chatMessages.map((message) =>
                  message.id === event.message.id ? event.message : message,
                ),
              }));
              break;
            case "error":
              if (event.data.text) {
                set({ chatError: "sending" });
              }
              break;
          }
        },
      });
    },
    stopChatStream() {
      if (stopStream) {
        stopStream();
        stopStream = undefined;
      }
      set({ isChatStreamConnected: false });
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
        await webChatService.sendMessage({
          text,
          clientMessageId: optimistic.id,
        });
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
        await webChatService.sendMessage({
          buttonReply,
          clientMessageId: optimistic.id,
        });
      } catch {
        set({ chatError: "sending" });
      } finally {
        set({ isChatSubmitting: false });
      }
    },
    async logout() {
      await webChatService.logout();
      const { stopChatStream, stopRecording } = get();
      stopChatStream();
      stopRecording(false);
      set({
        currentUser: undefined,
        chatMessages: [],
        chatInput: "",
        chatError: undefined,
        isChatBootstrapping: true,
        isChatSubmitting: false,
        isChatStreamConnected: false,
      });
    },
  };
};
