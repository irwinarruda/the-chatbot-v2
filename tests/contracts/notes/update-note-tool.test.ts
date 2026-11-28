import { describe, expect, test } from "vitest";
import { UpdateNoteToolDTO } from "~/contracts/tools/notes/update-note";

const noteId = "d8749e8c-57a9-4b9c-b6f7-392238f63312";

describe("update_note tool input", () => {
  test("accepts a rename or a new body", () => {
    expect(
      UpdateNoteToolDTO.parse({ note_id: noteId, name: " Ideias " }),
    ).toEqual({ note_id: noteId, name: "Ideias" });
    expect(
      UpdateNoteToolDTO.parse({ note_id: noteId, markdown: "# Novo" }),
    ).toEqual({ note_id: noteId, markdown: "# Novo" });
  });

  test("rejects an update without a name or a body", () => {
    expect(() => UpdateNoteToolDTO.parse({ note_id: noteId })).toThrow(
      "Send name, markdown or both",
    );
  });
});
