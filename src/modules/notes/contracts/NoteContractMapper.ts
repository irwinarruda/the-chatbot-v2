import { NoteResponseDTO } from "~/modules/notes/entities/dtos/NoteDTO";
import type { Note } from "~/modules/notes/entities/Note";

export function toNoteResponse(note: Note): NoteResponseDTO {
  return NoteResponseDTO.parse(note.toJSON());
}
