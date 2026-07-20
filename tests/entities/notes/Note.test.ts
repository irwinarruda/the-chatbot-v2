import { describe, expect, test } from "vitest";
import { Note } from "~/modules/notes/entities/Note";
import { ValidationException } from "~/shared/errors/DomainErrors";

describe("Note", () => {
  test("preserves Markdown exactly when creating and replacing content", () => {
    const markdown = "# Idea\n\n- [ ] Try it\n\n```ts\nconst x = 1;\n```\n";
    const note = new Note({
      idUser: crypto.randomUUID(),
      name: "  Project idea  ",
      markdown,
    });

    expect(note.name).toBe("Project idea");
    expect(note.markdown).toBe(markdown);

    const replacement = "[Reference](https://example.com)\n\n";
    note.replaceMarkdown(replacement);
    expect(note.markdown).toBe(replacement);
  });

  test("appends without rewriting existing Markdown", () => {
    const note = new Note({
      idUser: crypto.randomUUID(),
      name: "Ideas",
      markdown: "## Existing\n\nKeep  two spaces.  ",
    });

    note.appendMarkdown("## Added\n\nNew thought");

    expect(note.markdown).toBe(
      "## Existing\n\nKeep  two spaces.  \n\n## Added\n\nNew thought",
    );
  });

  test("requires an owner, a name, and a meaningful append", () => {
    expect(() => new Note({ idUser: "", name: "Missing owner" })).toThrow(
      ValidationException,
    );
    expect(() => new Note({ idUser: crypto.randomUUID(), name: " " })).toThrow(
      ValidationException,
    );
    const note = new Note({ idUser: crypto.randomUUID(), name: "Valid" });
    expect(() => note.appendMarkdown("  ")).toThrow(ValidationException);
  });
});
