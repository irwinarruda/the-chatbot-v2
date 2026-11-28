import { z } from "zod";

export const UpdateNoteToolDTO = z
  .object({
    note_id: z.string().uuid().describe("Exact note ID returned by list_notes"),
    name: z.string().trim().min(1).describe("New note name").optional(),
    markdown: z
      .string()
      .describe(
        "Complete new Markdown body. It replaces the whole existing body",
      )
      .optional(),
  })
  .refine(
    (input) => input.name !== undefined || input.markdown !== undefined,
    "Send name, markdown or both",
  );

export type UpdateNoteToolDTO = z.infer<typeof UpdateNoteToolDTO>;
