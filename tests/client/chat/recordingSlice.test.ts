import { describe, expect, test, vi } from "vitest";
import { create } from "zustand";
import { computed } from "zustand-computed-state";
import type { StartAudioRecordingServiceDTO } from "~/modules/chat/client/entities/dtos/StartAudioRecordingServiceDTO";
import { audioInputService } from "~/modules/chat/client/services/audioInputService";
import type { ChatSlice } from "~/modules/chat/client/state/chatSlice";
import {
  createRecordingSlice,
  type RecordingSlice,
} from "~/modules/chat/client/state/recordingSlice";
import { createDeferred } from "~/tests/utils/createDeferred";

type RecordingTestState = RecordingSlice &
  Pick<ChatSlice, "chatError" | "isChatSubmitting" | "sendChatAudio">;

describe("recordingSlice", () => {
  test("reset ignores pending microphone permission and late recorder callbacks", async () => {
    const permission = createDeferred<boolean>();
    let callbacks: StartAudioRecordingServiceDTO | undefined;
    const recording = {
      start: vi.fn((dto: StartAudioRecordingServiceDTO) => {
        callbacks = dto;
        return permission.promise;
      }),
      stop: vi.fn(),
      isActive: () => false,
    };
    const sendChatAudio = vi.fn(async () => {});
    const store = create<RecordingTestState>()(
      computed((...args) => ({
        ...createRecordingSlice(audioInputService, recording)(...args),
        isChatSubmitting: false,
        sendChatAudio,
      })),
    );
    const starting = store.getState().startRecording();
    store.getState().resetRecording();
    callbacks?.onTick(10);
    callbacks?.onEmptyRecording();
    await callbacks?.onRecorded({ blob: new Blob(["audio"]), url: "blob:old" });
    permission.resolve(true);
    await starting;
    expect(recording.stop).toHaveBeenCalledWith(false);
    expect(sendChatAudio).not.toHaveBeenCalled();
    expect(store.getState().chatError).toBeUndefined();
    expect(store.getState()).toMatchObject({
      isRecording: false,
      recordingDuration: 0,
    });
  });

  test("a cancelled device lookup cannot overwrite the next session's selected device", async () => {
    const devices =
      createDeferred<
        Awaited<ReturnType<typeof audioInputService.listAudioInputs>>
      >();
    const inputs = {
      ...audioInputService,
      listAudioInputs: () => devices.promise,
      storeDeviceId: vi.fn(),
    };
    const store = create<RecordingTestState>()(
      computed((...args) => ({
        ...createRecordingSlice(inputs)(...args),
        isChatSubmitting: false,
        async sendChatAudio() {},
      })),
    );
    const loading = store.getState().syncAudioInputs();
    store.getState().resetRecording();
    await store.getState().selectAudioInput("new-device");
    devices.resolve([]);
    await loading;
    expect(store.getState().selectedAudioInputId).toBe("new-device");
  });
});
