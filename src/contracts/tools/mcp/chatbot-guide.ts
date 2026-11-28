import { z } from "zod";
import { ToolTopic } from "~/domain/chat/tool-exposure";

export const ChatbotGuideToolDTO = z.object({
  topic: z
    .enum(ToolTopic)
    .describe(
      "Area to learn: general, finance, bills, notes, todos or artifacts",
    ),
});

export type ChatbotGuideToolDTO = z.infer<typeof ChatbotGuideToolDTO>;
