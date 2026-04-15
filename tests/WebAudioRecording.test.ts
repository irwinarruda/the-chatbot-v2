import {
  createRecordedAudioBlob,
  pickSupportedRecordingMimeType,
} from "~/utils/webAudioRecording";

describe("webAudioRecording", () => {
  test("prefers an actually supported recording mime type", () => {
    const mimeType = pickSupportedRecordingMimeType(
      (candidate) => candidate === "audio/mp4;codecs=mp4a.40.2",
    );

    expect(mimeType).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  test("does not force an unsupported recording mime type", () => {
    const mimeType = pickSupportedRecordingMimeType(() => false);

    expect(mimeType).toBeUndefined();
  });

  test("uses the actual recorded chunk mime type for the final blob", () => {
    const blob = createRecordedAudioBlob(
      [new Blob(["audio"], { type: "audio/webm;codecs=opus" })],
      "audio/mp4",
    );

    expect(blob.type).toBe("audio/webm;codecs=opus");
  });

  test("falls back to the recorder mime type when chunks are untyped", () => {
    const blob = createRecordedAudioBlob([new Blob(["audio"])], "audio/mp4");

    expect(blob.type).toBe("audio/mp4");
  });

  test("falls back to audio/webm when no audio mime type is available", () => {
    const blob = createRecordedAudioBlob([new Blob(["audio"])], "text/plain");

    expect(blob.type).toBe("audio/webm");
  });
});
