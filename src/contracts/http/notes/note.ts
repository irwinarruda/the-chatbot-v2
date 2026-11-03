import { z } from "zod";

export const NoteResponseDTO = z.object({
  id: z.string().uuid(),
  name: z.string(),
  markdown: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type NoteResponseDTO = z.infer<typeof NoteResponseDTO>;
export type NoteDTO = NoteResponseDTO;

export const NotesResponseDTO = z.object({ notes: z.array(NoteResponseDTO) });
export type NotesResponseDTO = z.infer<typeof NotesResponseDTO>;

export const NoteItemResponseDTO = z.object({ note: NoteResponseDTO });
export type NoteItemResponseDTO = z.infer<typeof NoteItemResponseDTO>;

export const CreateNoteRequestDTO = z.object({
  name: z.string().trim().min(1).max(160),
  markdown: z.string().optional(),
});
export type CreateNoteRequestDTO = z.infer<typeof CreateNoteRequestDTO>;

export const SaveNoteRequestDTO = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  markdown: z.string().optional(),
});
export type SaveNoteRequestDTO = z.infer<typeof SaveNoteRequestDTO>;

export const RefineNoteRequestDTO = z.object({
  instruction: z.string().trim().min(1).max(4_000),
  markdown: z.string(),
});
export type RefineNoteRequestDTO = z.infer<typeof RefineNoteRequestDTO>;

export const RefineNoteResponseDTO = z.object({ markdown: z.string() });
export type RefineNoteResponseDTO = z.infer<typeof RefineNoteResponseDTO>;
