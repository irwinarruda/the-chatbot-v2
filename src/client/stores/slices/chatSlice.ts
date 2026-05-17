import { compute } from "zustand-computed-state";
import type { AudioInputOption } from "~/client/entities/AudioInputOption";
import type { ChatMessage } from "~/client/entities/ChatMessage";
import type { CurrentUser } from "~/client/entities/CurrentUser";
import { audioInputService } from "~/client/services/audioInputService";
import { audioRecordingService } from "~/client/services/audioRecordingService";
import {
  WebChatAuthError,
  webChatService,
} from "~/client/services/webChatService";
import { webChatStreamService } from "~/client/services/webChatStreamService";
import type { AppState } from "~/client/stores";

export type ChatErrorCode = "loading" | "sending" | "microphone";

export type ChatSlice = {
  currentUser?: CurrentUser;
  chatMessages: ChatMessage[];
  chatInput: string;
  chatError?: ChatErrorCode;

  isChatBootstrapping: boolean;
  isChatSubmitting: boolean;
  isChatStreamConnected: boolean;

  audioInputOptions: AudioInputOption[];
  selectedAudioInputId: string;
  isRecording: boolean;
  recordingDuration: number;

  hasChatMessages: boolean;
  canSendChatInput: boolean;
  canSelectAudioInput: boolean;

  setChatInput: (input: string) => void;
  clearChatError: () => void;
  bootstrapChat: () => Promise<
    "ok" | "error" | "unauthorized" | "not_registered"
  >;
  startChatStream: () => void;
  stopChatStream: () => void;
  syncAudioInputs: () => Promise<void>;
  selectAudioInput: (deviceId: string) => Promise<void>;
  sendChatInput: () => Promise<void>;
  sendButtonReply: (buttonReply: string) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: (shouldSend: boolean) => void;
  logout: () => Promise<void>;
};

export const chatSlice: AppState<ChatSlice> = (set, get) => {
  let stopStream: (() => void) | undefined;
  return {
    currentUser: undefined,
    chatMessages: [],
    chatInput: "",
    chatError: undefined,
    isChatBootstrapping: true,
    isChatSubmitting: false,
    isChatStreamConnected: false,
    audioInputOptions: [],
    selectedAudioInputId: "",
    isRecording: false,
    recordingDuration: 0,
    ...compute(get, (state) => ({
      hasChatMessages: state.chatMessages.length > 0,
      canSendChatInput:
        state.chatInput.trim().length > 0 && !state.isChatSubmitting,
      canSelectAudioInput:
        state.audioInputOptions.length >= 2 &&
        !state.isChatSubmitting &&
        !state.isRecording,
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
          const stopCurrentStream = stopStream;
          stopStream = undefined;
          stopCurrentStream?.();
          set({ isChatStreamConnected: false });
        },
        onEvent: (event) => {
          const now = new Date().toISOString();
          switch (event.type) {
            case "text":
              set((state) => ({
                chatMessages: [
                  ...state.chatMessages,
                  {
                    id: crypto.randomUUID(),
                    type: "text" as const,
                    userType: "bot" as const,
                    text: event.data.text,
                    createdAt: now,
                  },
                ],
              }));
              break;
            case "interactive_button":
              set((state) => ({
                chatMessages: [
                  ...state.chatMessages,
                  {
                    id: crypto.randomUUID(),
                    type: "interactive" as const,
                    userType: "bot" as const,
                    text: event.data.text,
                    buttonReplyOptions: event.data.buttons,
                    createdAt: now,
                  },
                ],
              }));
              break;
            case "audio":
              set((state) => {
                let pendingAudioIndex = -1;
                for (let i = state.chatMessages.length - 1; i >= 0; i--) {
                  if (
                    state.chatMessages[i].type === "audio" &&
                    state.chatMessages[i].userType === "user" &&
                    !state.chatMessages[i].transcript
                  ) {
                    pendingAudioIndex = i;
                    break;
                  }
                }
                if (pendingAudioIndex < 0) return state;
                const updated = [...state.chatMessages];
                updated[pendingAudioIndex] = {
                  ...updated[pendingAudioIndex],
                  mediaUrl:
                    updated[pendingAudioIndex].mediaUrl ?? event.data.mediaUrl,
                  mimeType:
                    updated[pendingAudioIndex].mimeType ?? event.data.mimeType,
                  transcript: event.data.transcript,
                };
                return { chatMessages: updated };
              });
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
    async syncAudioInputs() {
      const devices = await audioInputService.listAudioInputs();
      const storedDeviceId = audioInputService.getStoredDeviceId();
      const { selectedAudioInputId } = get();
      const resolved = audioInputService.resolveSelected(
        devices,
        selectedAudioInputId || storedDeviceId,
      );
      set({ audioInputOptions: devices, selectedAudioInputId: resolved });
    },
    async selectAudioInput(deviceId) {
      set({ selectedAudioInputId: deviceId });
      audioInputService.storeDeviceId(deviceId);
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
        await webChatService.sendMessage({ text });
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
        await webChatService.sendMessage({ buttonReply });
      } catch {
        set({ chatError: "sending" });
      } finally {
        set({ isChatSubmitting: false });
      }
    },
    async startRecording() {
      try {
        const { selectedAudioInputId } = get();
        await audioRecordingService.start({
          audioInputDeviceId: selectedAudioInputId || undefined,
          onTick: (duration) => {
            set({ recordingDuration: duration });
          },
          onRecorded: async ({ blob, url }) => {
            set({ isChatSubmitting: true });
            const optimistic: ChatMessage = {
              id: crypto.randomUUID(),
              type: "audio",
              userType: "user",
              mediaUrl: url,
              mimeType: blob.type,
              createdAt: new Date().toISOString(),
            };
            set((state) => ({
              chatMessages: [...state.chatMessages, optimistic],
            }));
            try {
              await webChatService.sendAudio({ blob, mimeType: blob.type });
            } catch {
              set({ chatError: "sending" });
            } finally {
              set({ isChatSubmitting: false });
            }
          },
          onEmptyRecording: () => {
            set({ chatError: "sending" });
          },
        });
      } catch {
        set({ chatError: "microphone" });
        return;
      }
      set({ isRecording: true, recordingDuration: 0 });
      try {
        const { syncAudioInputs } = get();
        await syncAudioInputs();
      } catch {
        audioRecordingService.stop(false);
        set({ isRecording: false, recordingDuration: 0 });
      }
    },
    stopRecording(shouldSend) {
      audioRecordingService.stop(shouldSend);
      set({ isRecording: false, recordingDuration: 0 });
    },
    async logout() {
      await webChatService.logout();
      const { stopChatStream } = get();
      stopChatStream();
      set({
        currentUser: undefined,
        chatMessages: [],
        chatInput: "",
        chatError: undefined,
        isChatBootstrapping: true,
        isChatSubmitting: false,
        isChatStreamConnected: false,
        isRecording: false,
        recordingDuration: 0,
      });
    },
  };
};
