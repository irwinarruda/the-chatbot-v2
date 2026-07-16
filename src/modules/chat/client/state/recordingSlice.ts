import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { AudioInputOption } from "~/modules/chat/client/entities/AudioInputOption";
import { audioInputService } from "~/modules/chat/client/services/audioInputService";
import { audioRecordingService } from "~/modules/chat/client/services/audioRecordingService";
import { webChatService } from "~/modules/chat/client/services/webChatService";
import type { ChatMessageDTO } from "~/modules/chat/entities/dtos/ChatDTO";

export interface RecordingSlice {
  audioInputOptions: AudioInputOption[];
  selectedAudioInputId: string;
  isRecording: boolean;
  recordingDuration: number;
  canSelectAudioInput: boolean;
  syncAudioInputs: () => Promise<void>;
  selectAudioInput: (deviceId: string) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: (shouldSend: boolean) => void;
}

type RecordingState = RecordingSlice & {
  chatError?: "loading" | "sending" | "microphone";
  chatMessages: ChatMessageDTO[];
  isChatSubmitting: boolean;
};

export const recordingSlice: StateCreator<
  RecordingState,
  [],
  [],
  RecordingSlice
> = (set, get) => ({
  audioInputOptions: [],
  selectedAudioInputId: "",
  isRecording: false,
  recordingDuration: 0,
  ...compute("recording", get, (state) => ({
    canSelectAudioInput:
      state.audioInputOptions.length >= 2 && !state.isRecording,
  })),
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
  async startRecording() {
    try {
      const { selectedAudioInputId } = get();
      await audioRecordingService.start({
        audioInputDeviceId: selectedAudioInputId || undefined,
        onTick: (duration) => set({ recordingDuration: duration }),
        onRecorded: async ({ blob, url }) => {
          set({ isChatSubmitting: true });
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
          }));
          try {
            const messages = await webChatService.sendAudio({
              blob,
              mimeType: blob.type,
              clientMessageId: optimistic.id,
            });
            set({ chatMessages: messages });
          } catch {
            set({ chatError: "sending" });
          } finally {
            set({ isChatSubmitting: false });
          }
        },
        onEmptyRecording: () => set({ chatError: "sending" }),
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
});
