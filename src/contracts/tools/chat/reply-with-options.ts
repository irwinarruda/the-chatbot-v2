import { z } from "zod";

export const replyWithOptionsToolName = "reply_with_options";

export const ReplyWithOptionsToolDTO = z
  .object({
    message: z
      .string()
      .trim()
      .min(1)
      .describe(
        "The whole message body shown above the buttons. Include everything for this reply, such as what was done and the balances, and end with the question.",
      ),
    options: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(20, "A button label has at most 20 characters")
          .describe("Button label, at most 20 characters."),
      )
      .min(1)
      .max(3)
      .describe("1 to 3 button labels."),
  })
  .strict();

export type ReplyWithOptionsToolDTO = z.infer<typeof ReplyWithOptionsToolDTO>;
