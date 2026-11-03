import type { StateCreator } from "zustand";
import { compute } from "zustand-computed-state";
import type { AudioInputOption } from "~/client/modules/chat/app/entities/AudioInputOption";
import type { AudioInputGateway } from "~/client/modules/chat/app/gateways/AudioInputGateway";
import type { AudioRecordingGateway } from "~/client/modules/chat/app/gateways/AudioRecordingGateway";
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

export function createRecordingService(
  inputs: AudioInputGateway,
  recording: AudioRecordingGateway,
): StateCreator<RecordingState, [], [], RecordingService> {
  return (set, get) => {
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
        recording.stop(false);
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
        return inputs.subscribeToDeviceChanges(() => {
          void get().syncAudioInputs();
        });
      },
      async syncAudioInputs() {
        const request = ++devicesRequest;
        const devices = await inputs.listAudioInputs();
        if (request !== devicesRequest) return;
        const { selectedAudioInputId } = get();
        const resolved = inputs.resolveSelected(
          devices,
          selectedAudioInputId || inputs.getStoredDeviceId(),
        );
        set({ audioInputOptions: devices, selectedAudioInputId: resolved });
      },
      async selectAudioInput(deviceId) {
        devicesRequest += 1;
        set({ selectedAudioInputId: deviceId });
        inputs.storeDeviceId(deviceId);
      },
      async startRecording() {
        const { selectedAudioInputId, isRecording, isChatSubmitting } = get();
        if (isStarting || isRecording || isChatSubmitting) return;
        const request = ++generation;
        isStarting = true;
        try {
          const started = await recording.start({
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
          recording.stop(false);
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
        recording.stop(shouldSend);
        set({ isRecording: false, recordingDuration: 0 });
      },
    };
  };
}
