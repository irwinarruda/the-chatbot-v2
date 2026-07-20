import { z } from "zod";

export const CreateNoteToolDTO = z.object({
  name: z.string().trim().min(1).max(160).describe("Short note name"),
  markdown: z
    .string()
    .describe(
      "The complete note in standard Markdown. Preserve the user's intent and facts while making a rough capture easier to remember and read",
    ),
});

export type CreateNoteToolDTO = z.infer<typeof CreateNoteToolDTO>;
