import { z } from "zod";

export const replyWithOptionsToolName = "reply_with_options";

export const ReplyWithOptionsToolDTO = z
  .object({
    message: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(1).max(3),
  })
  .strict();

export type ReplyWithOptionsToolDTO = z.infer<typeof ReplyWithOptionsToolDTO>;
