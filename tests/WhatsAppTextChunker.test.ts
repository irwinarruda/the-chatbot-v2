import { WhatsAppTextChunker } from "~/utils/WhatsAppTextChunker";

describe("WhatsAppTextChunker", () => {
  test("short text returns one chunk", () => {
    const text = "Hello, World!";
    const chunks = WhatsAppTextChunker.chunk(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  test("empty text returns one chunk", () => {
    const chunks = WhatsAppTextChunker.chunk("");
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe("");
  });

  test("undefined text returns one chunk", () => {
    const chunks = WhatsAppTextChunker.chunk(undefined as unknown as string);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBeUndefined();
  });

  test("exactly at limit returns one chunk", () => {
    const text = "A".repeat(WhatsAppTextChunker.MaxChunkSize);
    const chunks = WhatsAppTextChunker.chunk(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  test("splits on paragraph break", () => {
    const paragraph1 = "A".repeat(3000);
    const paragraph2 = "B".repeat(3000);
    const text = `${paragraph1}\n\n${paragraph2}`;
    const chunks = WhatsAppTextChunker.chunk(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(paragraph1);
    expect(chunks[1]).toBe(paragraph2);
  });

  test("splits on line break", () => {
    const line1 = "A".repeat(3000);
    const line2 = "B".repeat(3000);
    const text = `${line1}\n${line2}`;
    const chunks = WhatsAppTextChunker.chunk(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(line1);
    expect(chunks[1]).toBe(line2);
  });

  test("splits on sentence end", () => {
    const sentence1 = `${"A".repeat(2500)}.`;
    const sentence2 = ` ${"B".repeat(2500)}`;
    const text = `${sentence1}${sentence2}`;
    const chunks = WhatsAppTextChunker.chunk(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(sentence1);
    expect(chunks[1]).toBe("B".repeat(2500));
  });

  test("splits on word boundary", () => {
    const words = Array(2000).fill("word").join(" ");
    const chunks = WhatsAppTextChunker.chunk(words);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(WhatsAppTextChunker.MaxChunkSize);
    }
  });

  test("hard cuts when no break points exist", () => {
    const text = "A".repeat(5000);
    const chunks = WhatsAppTextChunker.chunk(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]?.length).toBe(WhatsAppTextChunker.MaxChunkSize);
    expect(chunks[1]?.length).toBe(5000 - WhatsAppTextChunker.MaxChunkSize);
  });

  test("multiple chunks preserve all content", () => {
    const parts = Array.from({ length: 5 }, (_, i) =>
      String.fromCharCode(65 + i).repeat(2000),
    );
    const text = parts.join("\n\n");
    const chunks = WhatsAppTextChunker.chunk(text);
    const reassembled = chunks.join("\n\n");
    expect(reassembled).toBe(text);
  });

  test("all chunks respect max size", () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) =>
      "X".repeat(1000 + i * 100),
    );
    const text = paragraphs.join("\n\n");
    const chunks = WhatsAppTextChunker.chunk(text);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(WhatsAppTextChunker.MaxChunkSize);
    }
  });
});
