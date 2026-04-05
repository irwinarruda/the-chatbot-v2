export class WhatsAppTextChunker {
  static readonly MaxChunkSize = 4096;

  static chunk(text: string): string[] {
    if (!text || text.length <= WhatsAppTextChunker.MaxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > WhatsAppTextChunker.MaxChunkSize) {
      const splitIndex = findSplitIndex(remaining);
      chunks.push(remaining.slice(0, splitIndex).trimEnd());
      remaining = remaining.slice(splitIndex).trimStart();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }
    return chunks;
  }
}

function findSplitIndex(text: string): number {
  const searchRegion = text.slice(0, WhatsAppTextChunker.MaxChunkSize);

  const paragraphBreak = searchRegion.lastIndexOf("\n\n");
  if (paragraphBreak > WhatsAppTextChunker.MaxChunkSize / 4) {
    return paragraphBreak + 2;
  }

  const lineBreak = searchRegion.lastIndexOf("\n");
  if (lineBreak > WhatsAppTextChunker.MaxChunkSize / 4) {
    return lineBreak + 1;
  }

  const sentenceEnd = findLastSentenceEnd(searchRegion);
  if (sentenceEnd > WhatsAppTextChunker.MaxChunkSize / 4) {
    return sentenceEnd;
  }

  const space = searchRegion.lastIndexOf(" ");
  if (space > WhatsAppTextChunker.MaxChunkSize / 4) {
    return space + 1;
  }

  return WhatsAppTextChunker.MaxChunkSize;
}

function findLastSentenceEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?") {
      if (i + 1 < text.length && /\s/.test(text[i + 1] ?? "")) {
        return i + 2;
      }
    }
  }
  return -1;
}
