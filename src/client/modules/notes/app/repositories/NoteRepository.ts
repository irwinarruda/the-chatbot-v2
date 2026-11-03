import type {
  CreateNoteRequestDTO,
  NoteResponseDTO,
  RefineNoteRequestDTO,
  SaveNoteRequestDTO,
} from "~/contracts/http/notes/note";

export interface NoteRepository {
  listNotes(search?: string): Promise<NoteResponseDTO[]>;
  getNote(id: string): Promise<NoteResponseDTO>;
  createNote(dto: CreateNoteRequestDTO): Promise<NoteResponseDTO>;
  updateNote(id: string, dto: SaveNoteRequestDTO): Promise<NoteResponseDTO>;
  deleteNote(id: string): Promise<void>;
  refineNote(dto: RefineNoteRequestDTO): Promise<string>;
}
