const preferredAudioMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

export function pickSupportedRecordingMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string | undefined {
  return preferredAudioMimeTypes.find((mimeType) => isTypeSupported(mimeType));
}

export function resolveRecordedAudioMimeType(
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

export function createRecordedAudioBlob(
  chunks: Blob[],
  recorderMimeType?: string,
): Blob {
  return new Blob(chunks, {
    type: resolveRecordedAudioMimeType(chunks, recorderMimeType),
  });
}
