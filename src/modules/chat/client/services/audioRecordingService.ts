import { preferredAudioMimeTypesConstants } from "~/modules/chat/client/constants/preferredAudioMimeTypesConstants";

type StartAudioRecordingServiceDTO = {
  audioInputDeviceId?: string;
  onTick: (duration: number) => void;
  onRecorded: (recording: { blob: Blob; url: string }) => Promise<void> | void;
  onEmptyRecording: () => void;
};

let activeMediaRecorder: MediaRecorder | undefined;
let activeStream: MediaStream | undefined;
let activeChunks: Blob[] = [];
let activeTimer: ReturnType<typeof setInterval> | undefined;
let activeShouldSend = true;

export function resolveRecordedMimeType(
  chunks: Blob[],
  recorderMimeType?: string,
): string {
  for (const chunk of chunks) {
    const chunkMimeType = chunk.type.trim();
    if (chunkMimeType.startsWith("audio/")) return chunkMimeType;
  }
  const fallback = recorderMimeType?.trim() ?? "";
  if (fallback.startsWith("audio/")) return fallback;
  return "audio/webm";
}

export function createRecordedBlob(
  chunks: Blob[],
  recorderMimeType?: string,
): Blob {
  return new Blob(chunks, {
    type: resolveRecordedMimeType(chunks, recorderMimeType),
  });
}

export const audioRecordingService = {
  async start(dto: StartAudioRecordingServiceDTO): Promise<void> {
    if (activeMediaRecorder) {
      clearInterval(activeTimer);
      activeTimer = undefined;
      if (activeMediaRecorder.state === "recording") {
        activeMediaRecorder.stop();
      }
      activeMediaRecorder = undefined;
      if (activeStream) {
        for (const track of activeStream.getTracks()) track.stop();
        activeStream = undefined;
      }
      activeChunks = [];
    }
    try {
      const audioConstraint = dto.audioInputDeviceId
        ? { deviceId: { exact: dto.audioInputDeviceId } }
        : true;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraint,
      });

      activeStream = stream;
      activeChunks = [];
      activeShouldSend = true;

      const mimeType = preferredAudioMimeTypesConstants.find((m) =>
        MediaRecorder.isTypeSupported(m),
      );

      const recorder =
        mimeType !== undefined
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

      activeMediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          activeChunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }

        const shouldSend = activeShouldSend;
        activeMediaRecorder = undefined;
        activeStream = undefined;

        if (!shouldSend) {
          activeChunks = [];
          return;
        }

        const blob = createRecordedBlob(activeChunks, recorder.mimeType);
        activeChunks = [];

        if (blob.size === 0) {
          dto.onEmptyRecording();
          return;
        }

        const url = URL.createObjectURL(blob);
        await dto.onRecorded({ blob, url });
      };

      recorder.start();

      let duration = 0;
      activeTimer = setInterval(() => {
        duration += 1;
        dto.onTick(duration);
      }, 1000);
    } catch {
      throw new Error("Failed to start audio recording");
    }
  },

  stop(shouldSend: boolean): void {
    activeShouldSend = shouldSend;

    if (activeTimer !== undefined) {
      clearInterval(activeTimer);
      activeTimer = undefined;
    }

    if (activeMediaRecorder?.state === "recording") {
      activeMediaRecorder.stop();
    }
  },

  isActive(): boolean {
    return activeMediaRecorder?.state === "recording";
  },
};
