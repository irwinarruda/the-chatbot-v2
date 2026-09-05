import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { preferredAudioMimeTypesConstants } from "~/modules/chat/client/constants/preferredAudioMimeTypesConstants";
import {
  audioRecordingService,
  createRecordedBlob,
  resolveRecordedMimeType,
} from "~/modules/chat/client/services/audioRecordingService";
import { createDeferred } from "~/tests/utils/createDeferred";

describe("audioRecordingService", () => {
  test("prefers an actually supported recording mime type", () => {
    const mimeType = preferredAudioMimeTypesConstants.find(
      (candidate) => candidate === "audio/mp4;codecs=mp4a.40.2",
    );

    expect(mimeType).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  test("returns undefined when no candidate is supported", () => {
    const mimeType = preferredAudioMimeTypesConstants.find(() => false);

    expect(mimeType).toBeUndefined();
  });

  test("uses the actual recorded chunk mime type for the final blob", () => {
    const blob = createRecordedBlob(
      [new Blob(["audio"], { type: "audio/webm;codecs=opus" })],
      "audio/mp4",
    );

    expect(blob.type).toBe("audio/webm;codecs=opus");
  });

  test("falls back to the recorder mime type when chunks are untyped", () => {
    const blob = createRecordedBlob([new Blob(["audio"])], "audio/mp4");

    expect(blob.type).toBe("audio/mp4");
  });

  test("falls back to audio/webm when no audio mime type is available", () => {
    const blob = createRecordedBlob([new Blob(["audio"])], "text/plain");

    expect(blob.type).toBe("audio/webm");
  });

  test("resolves the recorded mime type from chunk types first", () => {
    const mimeType = resolveRecordedMimeType(
      [new Blob(["audio"], { type: "audio/webm;codecs=opus" })],
      "audio/mp4",
    );

    expect(mimeType).toBe("audio/webm;codecs=opus");
  });
});

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static failConstructor = false;
  static failStart = false;
  static isTypeSupported = () => true;

  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => Promise<void>;

  constructor() {
    if (FakeMediaRecorder.failConstructor)
      throw new Error("Unsupported recorder");
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    if (FakeMediaRecorder.failStart)
      throw new Error("Recorder failed to start");
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
  }

  emitAudio(text: string) {
    this.ondataavailable?.({ data: new Blob([text], { type: this.mimeType }) });
  }
}

function createStream() {
  const stop = vi.fn();
  return { getTracks: () => [{ stop }], stop };
}

function createCallbacks() {
  return {
    onTick: vi.fn(),
    onRecorded: vi.fn(),
    onEmptyRecording: vi.fn(),
  };
}

describe("audio recording lifecycle", () => {
  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.failConstructor = false;
    FakeMediaRecorder.failStart = false;
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.useFakeTimers();
  });

  afterEach(() => {
    audioRecordingService.stop(false);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("a replaced recorder cannot send chunks or clear the next recording", async () => {
    const firstStream = createStream();
    const secondStream = createStream();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(firstStream)
      .mockResolvedValueOnce(secondStream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const first = createCallbacks();
    const second = createCallbacks();
    await audioRecordingService.start(first);
    const firstRecorder = FakeMediaRecorder.instances[0];
    firstRecorder.emitAudio("first");
    await audioRecordingService.start(second);
    const secondRecorder = FakeMediaRecorder.instances[1];
    secondRecorder.emitAudio("second");
    await firstRecorder.onstop?.();

    expect(first.onRecorded).not.toHaveBeenCalled();
    expect(firstStream.stop).toHaveBeenCalledOnce();
    expect(secondStream.stop).not.toHaveBeenCalled();
    expect(audioRecordingService.isActive()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(second.onTick).toHaveBeenCalledWith(1);
    audioRecordingService.stop(true);
    await secondRecorder.onstop?.();
    expect(second.onRecorded).toHaveBeenCalledOnce();
    const [recording] = second.onRecorded.mock.calls[0];
    expect(await recording.blob.text()).toBe("second");
  });

  test.each(["constructor", "start"])(
    "releases acquired tracks when recorder %s fails",
    async (failure) => {
      const stream = createStream();
      vi.stubGlobal("navigator", {
        mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      });
      FakeMediaRecorder.failConstructor = failure === "constructor";
      FakeMediaRecorder.failStart = failure === "start";
      await expect(
        audioRecordingService.start(createCallbacks()),
      ).rejects.toThrow("Failed to start audio recording");
      expect(stream.stop).toHaveBeenCalledOnce();
      expect(audioRecordingService.isActive()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test("stop cancels a pending microphone request and releases its late stream", async () => {
    const pending = createDeferred<ReturnType<typeof createStream>>();
    const stream = createStream();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: () => pending.promise },
    });
    const started = audioRecordingService.start(createCallbacks());
    audioRecordingService.stop(false);
    pending.resolve(stream);
    await expect(started).resolves.toBe(false);
    expect(stream.stop).toHaveBeenCalledOnce();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(audioRecordingService.isActive()).toBe(false);
  });

  test("a late microphone request cannot replace a newer recording", async () => {
    const pending = createDeferred<ReturnType<typeof createStream>>();
    const firstStream = createStream();
    const secondStream = createStream();
    const getUserMedia = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(secondStream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const firstStart = audioRecordingService.start(createCallbacks());
    await expect(audioRecordingService.start(createCallbacks())).resolves.toBe(
      true,
    );
    pending.resolve(firstStream);
    await expect(firstStart).resolves.toBe(false);
    expect(firstStream.stop).toHaveBeenCalledOnce();
    expect(secondStream.stop).not.toHaveBeenCalled();
    expect(audioRecordingService.isActive()).toBe(true);
  });

  test("keeps the preview URL until its consumer settles and revokes it on failure", async () => {
    const stream = createStream();
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:audio");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const upload = createDeferred<void>();
    await audioRecordingService.start({
      ...createCallbacks(),
      onRecorded: () => upload.promise,
    });
    const recorder = FakeMediaRecorder.instances[0];
    recorder.emitAudio("recording");
    audioRecordingService.stop(true);
    const finished = recorder.onstop?.();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    const result = expect(finished).rejects.toThrow("Upload failed");
    upload.reject(new Error("Upload failed"));
    await result;
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:audio");
    expect(stream.stop).toHaveBeenCalledOnce();
  });
});
