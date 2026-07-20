import {
  type CreateNoteRequestDTO,
  NoteItemResponseDTO,
  type NoteResponseDTO,
  NotesResponseDTO,
  type RefineNoteRequestDTO,
  RefineNoteResponseDTO,
  type SaveNoteRequestDTO,
} from "~/modules/notes/entities/dtos/NoteDTO";
import {
  normalizeApiResponse,
  parseApiResponse,
} from "~/shared/client/utils/ApiResponseParser";
import { ApiErrorResponseDTO } from "~/shared/entities/dtos/ApiErrorDTO";

async function parseError(response: Response): Promise<Error> {
  const body = ApiErrorResponseDTO.safeParse(
    normalizeApiResponse(await response.json()),
  );
  if (body.success) return new Error(body.data.message);
  return new Error(`Request failed with ${response.status}`);
}

export const noteService = {
  async listNotes(search?: string): Promise<NoteResponseDTO[]> {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    let url = "/api/v1/web/notes";
    if (params.size > 0) url = `${url}?${params}`;
    const response = await fetch(url);
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(NotesResponseDTO, await response.json()).notes;
  },

  async getNote(id: string): Promise<NoteResponseDTO> {
    const response = await fetch(`/api/v1/web/notes/${id}`);
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(NoteItemResponseDTO, await response.json()).note;
  },

  async createNote(dto: CreateNoteRequestDTO): Promise<NoteResponseDTO> {
    const response = await fetch("/api/v1/web/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(NoteItemResponseDTO, await response.json()).note;
  },

  async updateNote(
    id: string,
    dto: SaveNoteRequestDTO,
  ): Promise<NoteResponseDTO> {
    const response = await fetch(`/api/v1/web/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(NoteItemResponseDTO, await response.json()).note;
  },

  async deleteNote(id: string): Promise<void> {
    const response = await fetch(`/api/v1/web/notes/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw await parseError(response);
  },

  async refineNote(dto: RefineNoteRequestDTO): Promise<string> {
    const response = await fetch("/api/v1/web/notes/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) throw await parseError(response);
    return parseApiResponse(RefineNoteResponseDTO, await response.json())
      .markdown;
  },
};
