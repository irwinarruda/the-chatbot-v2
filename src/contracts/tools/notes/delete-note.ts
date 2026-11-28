import { z } from "zod";

export const DeleteNoteToolDTO = z.object({
  note_id: z.string().uuid().describe("Exact note ID returned by list_notes"),
});

export type DeleteNoteToolDTO = z.infer<typeof DeleteNoteToolDTO>;
