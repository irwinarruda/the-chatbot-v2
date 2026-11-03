import { z } from "zod";

export const ReadNoteToolDTO = z.object({
  note_id: z.string().uuid().describe("Exact note ID returned by list_notes"),
});

export type ReadNoteToolDTO = z.infer<typeof ReadNoteToolDTO>;
