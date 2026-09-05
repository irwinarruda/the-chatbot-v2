import { z } from "zod";
import { AiUsageDTO } from "~/modules/chat/entities/dtos/AiUsageDTO";
import { ChatChannel } from "~/modules/chat/entities/enums/ChatChannel";

export const StoredAiGenerationMetadataDTO = z.object({
  usage: AiUsageDTO.optional(),
  diagnostics: z.array(z.unknown()).optional(),
});
export type StoredAiGenerationMetadataDTO = z.infer<
  typeof StoredAiGenerationMetadataDTO
>;

export const StoredConversationSummaryDTO = z.object({
  userProfile: z.array(z.string()),
  durableFacts: z.array(z.string()),
  compactedThroughSequence: z.number().int().nonnegative(),
});
export type StoredConversationSummaryDTO = z.infer<
  typeof StoredConversationSummaryDTO
>;

export const StoredChatChannelDTO = z.enum(ChatChannel);
export type StoredChatChannelDTO = z.infer<typeof StoredChatChannelDTO>;
