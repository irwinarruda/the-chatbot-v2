import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { AudioInputOption } from "~/client/modules/chat/app/entities/AudioInputOption";
import { container } from "~/client/shared/container";
import type { ChatService } from "./ChatService";

export interface RecordingService {
  audioInputOptions: AudioInputOption[];
  selectedAudioInputId: string;
  isRecording: boolean;
  recordingDuration: number;
  canSelectAudioInput: boolean;
  syncAudioInputs: () => Promise<void>;
  watchAudioInputs: () => () => void;
  selectAudioInput: (deviceId: string) => Promise<void>;
  startRecording: () => Promise<void>;
  resetRecording: () => void;
  stopRecording: (shouldSend: boolean) => void;
}

type RecordingState = RecordingService &
  Pick<ChatService, "chatError" | "isChatSubmitting" | "sendChatAudio">;

export const createRecordingService: StateCreator<
  RecordingState,
  [],
  [],
  RecordingService
> = (set, get) => {
  let generation = 0;
  let devicesRequest = 0;
  let isStarting = false;
  return {
    audioInputOptions: [],
    selectedAudioInputId: "",
    isRecording: false,
    recordingDuration: 0,
    ...compute("recording", get, (state) => ({
      canSelectAudioInput:
        state.audioInputOptions.length >= 2 && !state.isRecording,
    })),
    resetRecording() {
      generation += 1;
      devicesRequest += 1;
      isStarting = false;
      container.get("AudioRecordingGateway").stop(false);
      set({
        audioInputOptions: [],
        selectedAudioInputId: "",
        isRecording: false,
        recordingDuration: 0,
      });
    },
    watchAudioInputs() {
      const { syncAudioInputs } = get();
      void syncAudioInputs();
      return container.get("AudioInputGateway").subscribeToDeviceChanges(() => {
        void get().syncAudioInputs();
      });
    },
    async syncAudioInputs() {
      const request = ++devicesRequest;
      const audioInputGateway = container.get("AudioInputGateway");
      const devices = await audioInputGateway.listAudioInputs();
      if (request !== devicesRequest) return;
      const { selectedAudioInputId } = get();
      const resolved = audioInputGateway.resolveSelected(
        devices,
        selectedAudioInputId || audioInputGateway.getStoredDeviceId(),
      );
      set({ audioInputOptions: devices, selectedAudioInputId: resolved });
    },
    async selectAudioInput(deviceId) {
      devicesRequest += 1;
      set({ selectedAudioInputId: deviceId });
      container.get("AudioInputGateway").storeDeviceId(deviceId);
    },
    async startRecording() {
      const { selectedAudioInputId, isRecording, isChatSubmitting } = get();
      if (isStarting || isRecording || isChatSubmitting) return;
      const request = ++generation;
      isStarting = true;
      try {
        const started = await container.get("AudioRecordingGateway").start({
          audioInputDeviceId: selectedAudioInputId || undefined,
          onTick(duration) {
            if (request === generation) set({ recordingDuration: duration });
          },
          async onRecorded({ blob, url }) {
            if (request !== generation) return;
            const { sendChatAudio } = get();
            await sendChatAudio(blob, url);
          },
          onEmptyRecording() {
            if (request === generation) set({ chatError: "sending" });
          },
        });
        if (request !== generation || !started) return;
        set({ isRecording: true, recordingDuration: 0 });
        const { syncAudioInputs } = get();
        await syncAudioInputs();
      } catch {
        if (request !== generation) return;
        container.get("AudioRecordingGateway").stop(false);
        set({
          chatError: "microphone",
          isRecording: false,
          recordingDuration: 0,
        });
      } finally {
        if (request === generation) isStarting = false;
      }
    },
    stopRecording(shouldSend) {
      if (!shouldSend) generation += 1;
      isStarting = false;
      container.get("AudioRecordingGateway").stop(shouldSend);
      set({ isRecording: false, recordingDuration: 0 });
    },
  };
};
