import {
  type CreateNoteRequestDTO,
  NoteItemResponseDTO,
  type NoteResponseDTO,
  NotesResponseDTO,
  type RefineNoteRequestDTO,
  RefineNoteResponseDTO,
  type SaveNoteRequestDTO,
} from "~/modules/notes/entities/dtos/NoteDTO";
import { apiClient } from "~/shared/client/services/ApiClient";

export const noteService = {
  async listNotes(search?: string): Promise<NoteResponseDTO[]> {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    let url = "/api/v1/web/notes";
    if (params.size > 0) url = `${url}?${params}`;
    const response = await apiClient.request(url);
    return NotesResponseDTO.parse(await response.json()).notes;
  },

  async getNote(id: string): Promise<NoteResponseDTO> {
    const response = await apiClient.request(`/api/v1/web/notes/${id}`);
    return NoteItemResponseDTO.parse(await response.json()).note;
  },

  async createNote(dto: CreateNoteRequestDTO): Promise<NoteResponseDTO> {
    const response = await apiClient.request("/api/v1/web/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return NoteItemResponseDTO.parse(await response.json()).note;
  },

  async updateNote(
    id: string,
    dto: SaveNoteRequestDTO,
  ): Promise<NoteResponseDTO> {
    const response = await apiClient.request(`/api/v1/web/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return NoteItemResponseDTO.parse(await response.json()).note;
  },

  async deleteNote(id: string): Promise<void> {
    await apiClient.request(`/api/v1/web/notes/${id}`, {
      method: "DELETE",
    });
  },

  async refineNote(dto: RefineNoteRequestDTO): Promise<string> {
    const response = await apiClient.request("/api/v1/web/notes/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return RefineNoteResponseDTO.parse(await response.json()).markdown;
  },
};
