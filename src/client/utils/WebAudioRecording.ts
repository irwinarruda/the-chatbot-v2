export class WebAudioRecording {
  private static readonly PreferredAudioMimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  static pickSupportedMimeType(
    isTypeSupported: (mimeType: string) => boolean,
  ): string | undefined {
    return WebAudioRecording.PreferredAudioMimeTypes.find((mimeType) =>
      isTypeSupported(mimeType),
    );
  }

  static resolveRecordedMimeType(
    chunks: Blob[],
    recorderMimeType?: string,
  ): string {
    for (const chunk of chunks) {
      const chunkMimeType = chunk.type.trim();
      if (chunkMimeType.startsWith("audio/")) {
        return chunkMimeType;
      }
    }

    const fallbackMimeType = recorderMimeType?.trim() ?? "";
    if (fallbackMimeType.startsWith("audio/")) {
      return fallbackMimeType;
    }

    return "audio/webm";
  }

  static createRecordedBlob(chunks: Blob[], recorderMimeType?: string): Blob {
    return new Blob(chunks, {
      type: WebAudioRecording.resolveRecordedMimeType(chunks, recorderMimeType),
    });
  }
}
