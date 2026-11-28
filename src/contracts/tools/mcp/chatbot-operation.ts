import { z } from "zod";

export const ChatbotOperationToolDTO = z.object({
  operation: z
    .string()
    .min(1)
    .describe("Exact operation name from chatbot_guide, such as list_todos"),
  input: z
    .record(z.string(), z.unknown())
    .default({})
    .describe(
      "Arguments object for the operation, shaped exactly like its input schema in chatbot_guide. Send {} when it takes none",
    ),
});

export type ChatbotOperationToolDTO = z.infer<typeof ChatbotOperationToolDTO>;
