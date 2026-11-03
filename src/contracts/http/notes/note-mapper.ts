import type { Note } from "~/domain/notes/note";
import { NoteResponseDTO } from "./note";

export function toNoteResponse(note: Note): NoteResponseDTO {
  return NoteResponseDTO.parse(note.toJSON());
}
