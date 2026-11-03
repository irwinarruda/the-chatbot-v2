import { DemoNow, mockDb } from "~/client/mock/db";
import type { NoteRepository } from "~/client/modules/notes/app/repositories/NoteRepository";
import type {
  CreateNoteRequestDTO,
  NoteResponseDTO,
  RefineNoteRequestDTO,
  SaveNoteRequestDTO,
} from "~/contracts/http/notes/note";
import { NotFoundError } from "./NotFoundError";

export class TestNoteRepository implements NoteRepository {
  async listNotes(search?: string) {
    const query = search?.trim().toLowerCase();
    if (!query) return mockDb.notes;
    return mockDb.notes.filter((note) =>
      `${note.name} ${note.markdown}`.toLowerCase().includes(query),
    );
  }

  async getNote(id: string) {
    return findNote(id);
  }

  async createNote(dto: CreateNoteRequestDTO) {
    const note: NoteResponseDTO = {
      id: crypto.randomUUID(),
      name: dto.name,
      markdown: dto.markdown ?? "",
      createdAt: DemoNow,
      updatedAt: DemoNow,
    };
    mockDb.notes.unshift(note);
    return note;
  }

  async updateNote(id: string, dto: SaveNoteRequestDTO) {
    const note = findNote(id);
    if (dto.name !== undefined) note.name = dto.name;
    if (dto.markdown !== undefined) note.markdown = dto.markdown;
    note.updatedAt = DemoNow;
    return note;
  }

  async deleteNote(id: string) {
    mockDb.notes = mockDb.notes.filter((note) => note.id !== id);
  }

  async refineNote(dto: RefineNoteRequestDTO) {
    return `${dto.markdown.trim()}\n\n_Refined in demo mode: ${dto.instruction}_\n`;
  }
}

function findNote(id: string): NoteResponseDTO {
  const note = mockDb.notes.find((candidate) => candidate.id === id);
  if (!note) throw new NotFoundError("Note not found");
  return note;
}
