import { describe, expect, test } from "vitest";
import {
  CreateNoteRequestDTO,
  RefineNoteRequestDTO,
  SaveNoteRequestDTO,
} from "~/contracts/http/notes/note";
import { toNoteResponse } from "~/contracts/http/notes/note-mapper";
import { Note } from "~/domain/notes/note";

describe("Note contracts", () => {
  test("maps exact Markdown through the wire response", () => {
    const markdown = "# Saved\n\n[link](https://example.com)\n";
    const note = new Note({
      idUser: crypto.randomUUID(),
      name: "Reference",
      markdown,
    });
    const response = toNoteResponse(note);
    const wire = JSON.parse(JSON.stringify(response));

    expect(wire.markdown).toBe(markdown);
    expect(wire).toMatchObject({
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    });
  });

  test("accepts Markdown without trimming it", () => {
    const markdown = "  indented\n\n";
    expect(
      CreateNoteRequestDTO.parse({ name: "Draft", markdown }).markdown,
    ).toBe(markdown);
    expect(SaveNoteRequestDTO.parse({ markdown }).markdown).toBe(markdown);
    expect(
      RefineNoteRequestDTO.parse({
        instruction: "  Organize this  ",
        markdown,
      }),
    ).toEqual({ instruction: "Organize this", markdown });
  });
});
