import { z } from "zod";

export const AppendToNoteToolDTO = z.object({
  note_id: z.string().uuid().describe("Exact note ID returned by list_notes"),
  markdown: z
    .string()
    .refine((value) => value.trim().length > 0, "Markdown is required")
    .describe(
      "Standard Markdown to append without rewriting the existing note",
    ),
});

export type AppendToNoteToolDTO = z.infer<typeof AppendToNoteToolDTO>;
