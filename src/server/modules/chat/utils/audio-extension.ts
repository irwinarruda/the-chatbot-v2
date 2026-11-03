export function audioExtensionFor(mimeType: string): string {
  const baseType = mimeType.split(";")[0].trim().toLowerCase();
  switch (baseType) {
    case "audio/ogg":
      return ".ogg";
    case "audio/mpeg":
    case "audio/mp3":
      return ".mp3";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return ".m4a";
    case "audio/aac":
      return ".aac";
    case "audio/amr":
      return ".amr";
    case "audio/webm":
      return ".webm";
    case "audio/wav":
    case "audio/wave":
    case "audio/x-wav":
      return ".wav";
    default:
      return ".bin";
  }
}
