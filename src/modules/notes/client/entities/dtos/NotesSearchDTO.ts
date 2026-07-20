import { z } from "zod";

export const NotesSearchDTO = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
});

export type NotesSearchDTO = z.infer<typeof NotesSearchDTO>;

export function normalizeNotesSearch(
  search: Record<string, unknown>,
): NotesSearchDTO {
  return NotesSearchDTO.parse(search);
}
