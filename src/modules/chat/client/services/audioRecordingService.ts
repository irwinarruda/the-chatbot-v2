import { preferredAudioMimeTypesConstants } from "~/modules/chat/client/constants/preferredAudioMimeTypesConstants";
import type { StartAudioRecordingServiceDTO } from "~/modules/chat/client/entities/dtos/StartAudioRecordingServiceDTO";

interface RecordingSession {
  recorder?: MediaRecorder;
  stream?: MediaStream;
  chunks: Blob[];
  timer?: ReturnType<typeof setInterval>;
  shouldSend: boolean;
}

let activeSession: RecordingSession | undefined;

function releaseRecording(session: RecordingSession) {
  clearInterval(session.timer);
  session.timer = undefined;
  for (const track of session.stream?.getTracks() ?? []) track.stop();
  session.stream = undefined;
  if (activeSession === session) activeSession = undefined;
}

function stopRecording(session: RecordingSession, shouldSend: boolean) {
  session.shouldSend = shouldSend;
  if (session.recorder && session.recorder.state !== "inactive") {
    session.recorder.stop();
  }
  releaseRecording(session);
}

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
  async start(dto: StartAudioRecordingServiceDTO): Promise<boolean> {
    if (activeSession) stopRecording(activeSession, false);
    const session: RecordingSession = { chunks: [], shouldSend: true };
    activeSession = session;
    try {
      let audio: MediaTrackConstraints | boolean = true;
      if (dto.audioInputDeviceId) {
        audio = { deviceId: { exact: dto.audioInputDeviceId } };
      }
      session.stream = await navigator.mediaDevices.getUserMedia({ audio });
      if (activeSession !== session) {
        releaseRecording(session);
        return false;
      }
      const mimeType = preferredAudioMimeTypesConstants.find((candidate) =>
        MediaRecorder.isTypeSupported(candidate),
      );
      const recorder = new MediaRecorder(session.stream, { mimeType });
      session.recorder = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) session.chunks.push(event.data);
      };
      recorder.onstop = async () => {
        releaseRecording(session);
        if (!session.shouldSend) return;
        const blob = createRecordedBlob(session.chunks, recorder.mimeType);
        session.chunks = [];
        if (blob.size === 0) {
          dto.onEmptyRecording();
          return;
        }
        const url = URL.createObjectURL(blob);
        try {
          await dto.onRecorded({ blob, url });
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      recorder.start();
      let duration = 0;
      session.timer = setInterval(() => {
        duration += 1;
        dto.onTick(duration);
      }, 1000);
      return true;
    } catch {
      const wasActive = activeSession === session;
      stopRecording(session, false);
      if (!wasActive) return false;
      throw new Error("Failed to start audio recording");
    }
  },

  stop(shouldSend: boolean): void {
    if (activeSession) stopRecording(activeSession, shouldSend);
  },

  isActive(): boolean {
    return activeSession?.recorder?.state === "recording";
  },
};
