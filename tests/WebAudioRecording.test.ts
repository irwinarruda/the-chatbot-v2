import { describe, expect, test } from "vitest";
import { preferredAudioMimeTypesConstants } from "~/modules/chat/client/constants/preferredAudioMimeTypesConstants";
import {
  createRecordedBlob,
  resolveRecordedMimeType,
} from "~/modules/chat/client/services/audioRecordingService";

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
