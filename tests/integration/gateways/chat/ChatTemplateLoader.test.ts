import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ChatTemplateLoader } from "~/modules/chat/utils/ChatTemplateLoader";
import {
  MessageLoader,
  MessageLocale,
  MessageTemplate,
} from "~/modules/chat/utils/MessageLoader";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";

const directories: string[] = [];

function createTemplateFile(contents: string) {
  const directory = mkdtempSync(join(tmpdir(), "chat-template-test-"));
  directories.push(directory);
  const filePath = join(directory, "message.txt");
  writeFileSync(filePath, contents);
  return {
    loader: new ChatTemplateLoader(directory, "Message template file"),
    filePath,
  };
}

afterEach(() => {
  for (const directory of directories)
    rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

describe("ChatTemplateLoader", () => {
  test("caches source text while rendering each call's values separately", () => {
    const { loader, filePath } = createTemplateFile(
      "Hello {{Name}}: {{Unknown}} {{Empty}}",
    );
    expect(loader.load("message.txt", { Name: "first", Empty: "" })).toBe(
      "Hello first: {{Unknown}} ",
    );
    writeFileSync(filePath, "Changed on disk");
    expect(loader.load("message.txt", { Name: "second" })).toBe(
      "Hello second: {{Unknown}} {{Empty}}",
    );
  });

  test("reports missing files even after a cached read", () => {
    const { loader, filePath } = createTemplateFile("Cached text");
    expect(loader.load("message.txt")).toBe("Cached text");
    unlinkSync(filePath);
    expect(() => loader.load("message.txt")).toThrow(NotFoundException);
    expect(() => loader.load("message.txt")).toThrow(
      `Message template file not found: ${filePath}`,
    );
  });
});

describe("message templates", () => {
  test("substitutes message parameters without retaining another call's values", () => {
    const first = MessageLoader.getMessage(
      MessageTemplate.ThankYou,
      { loginUrl: "https://first.example" },
      MessageLocale.En,
    );
    const second = MessageLoader.getMessage(
      MessageTemplate.ThankYou,
      { loginUrl: "https://second.example" },
      MessageLocale.En,
    );
    expect(first).toContain("https://first.example");
    expect(second).toContain("https://second.example");
    expect(second).not.toContain("https://first.example");
    expect(
      MessageLoader.getMessage(
        MessageTemplate.ThankYou,
        undefined,
        MessageLocale.En,
      ),
    ).toContain("{{LoginUrl}}");
  });
});
