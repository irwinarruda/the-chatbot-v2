import { describe, expect, test } from "vitest";
import { toNoteResponse } from "~/modules/notes/contracts/NoteContractMapper";
import {
  CreateNoteRequestDTO,
  RefineNoteRequestDTO,
  SaveNoteRequestDTO,
} from "~/modules/notes/entities/dtos/NoteDTO";
import { Note } from "~/modules/notes/entities/Note";
import { Printable } from "~/shared/http/utils/Printable";

describe("Note contracts", () => {
  test("maps exact Markdown through the wire response", () => {
    const markdown = "# Saved\n\n[link](https://example.com)\n";
    const note = new Note({
      idUser: crypto.randomUUID(),
      name: "Reference",
      markdown,
    });
    const response = toNoteResponse(note);
    const wire = JSON.parse(Printable.make(response));

    expect(wire.markdown).toBe(markdown);
    expect(wire).toMatchObject({
      created_at: response.createdAt,
      updated_at: response.updatedAt,
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
