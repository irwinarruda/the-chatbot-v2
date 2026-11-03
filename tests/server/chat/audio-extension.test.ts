import { describe, expect, test } from "vitest";
import { audioExtensionFor } from "~/server/modules/chat/utils/audio-extension";

describe("audioExtensionFor", () => {
  test("maps known audio types and falls back to a binary extension", () => {
    expect(audioExtensionFor("audio/ogg")).toBe(".ogg");
    expect(audioExtensionFor("audio/mp3")).toBe(".mp3");
    expect(audioExtensionFor("audio/m4a")).toBe(".m4a");
    expect(audioExtensionFor("audio/aac")).toBe(".aac");
    expect(audioExtensionFor("audio/amr")).toBe(".amr");
    expect(audioExtensionFor("audio/webm")).toBe(".webm");
    expect(audioExtensionFor("audio/wave")).toBe(".wav");
    expect(audioExtensionFor("application/octet-stream")).toBe(".bin");
  });
});
