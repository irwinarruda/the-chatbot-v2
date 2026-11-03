import { z } from "zod";

export const ListNotesToolDTO = z.object({
  search: z
    .string()
    .trim()
    .min(1)
    .describe("Optional search across note names and Markdown content")
    .optional(),
});

export type ListNotesToolDTO = z.infer<typeof ListNotesToolDTO>;
