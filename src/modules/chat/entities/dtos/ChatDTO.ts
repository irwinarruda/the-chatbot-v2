import { z } from "zod";
import { AiUsageDTO } from "~/modules/chat/entities/dtos/AiUsageDTO";
import { ReasoningEffort } from "~/modules/chat/entities/enums/ReasoningEffort";
import { ToolResultStatus } from "~/modules/chat/entities/enums/ToolResultStatus";

export const GenerationTraceItemDTO = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("reasoning"),
    text: z.string(),
    redacted: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("toolCall"),
    callId: z.string().min(1),
    name: z.string().min(1),
    arguments: z.unknown(),
  }),
  z.object({
    type: z.literal("toolResult"),
    callId: z.string().min(1),
    outcome: z.unknown(),
  }),
]);

export const AiGenerationTraceDTO = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  api: z.string().min(1).optional(),
  reasoningEffort: z.enum(ReasoningEffort),
  finishReason: z.string().min(1),
  usage: AiUsageDTO.optional(),
  items: z.array(GenerationTraceItemDTO),
});

export const ChannelMessageResponseDTO = z.object({
  id: z.string().uuid(),
  clientMessageId: z.string().min(1).optional(),
  type: z.enum(["text", "interactive", "audio", "command"]),
  userType: z.enum(["user", "bot"]),
  text: z.string().optional(),
  buttonReply: z.string().optional(),
  buttonReplyOptions: z.array(z.string()).optional(),
  mediaUrl: z.string().optional(),
  mimeType: z.string().optional(),
  transcript: z.string().optional(),
  trace: z.array(AiGenerationTraceDTO).optional(),
  createdAt: z.iso.datetime(),
});

export type ChannelMessageResponseDTO = z.infer<
  typeof ChannelMessageResponseDTO
>;
export type ChatMessageDTO = ChannelMessageResponseDTO;

export const AiModelSelectionResponseDTO = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
});

export type AiModelSelectionResponseDTO = z.infer<
  typeof AiModelSelectionResponseDTO
>;

export const ChatMessagesResponseDTO = z.object({
  messages: z.array(ChannelMessageResponseDTO),
  currentModel: AiModelSelectionResponseDTO,
  availableModels: z.array(AiModelSelectionResponseDTO),
  reasoningEffort: z.enum(ReasoningEffort),
  supportedReasoningEfforts: z.array(z.enum(ReasoningEffort)).min(1),
});

export type ChatMessagesResponseDTO = z.infer<typeof ChatMessagesResponseDTO>;
export type WebChatDTO = ChatMessagesResponseDTO;
export type AiGenerationTraceDTO = z.infer<typeof AiGenerationTraceDTO>;
export type GenerationTraceItemDTO = z.infer<typeof GenerationTraceItemDTO>;

const ReasoningDeltaEventDTO = z.object({
  type: z.literal("reasoningDelta"),
  round: z.number().int().positive(),
  contentIndex: z.number().int().nonnegative(),
  delta: z.string(),
});

const ToolCallEventDTO = z.object({
  type: z.literal("toolCall"),
  round: z.number().int().positive(),
  contentIndex: z.number().int().nonnegative(),
  callId: z.string().min(1),
  name: z.string().min(1),
  arguments: z.unknown(),
});

const ToolResultEventDTO = z.object({
  type: z.literal("toolResult"),
  round: z.number().int().positive(),
  callId: z.string().min(1),
  name: z.string().min(1),
  outcome: z.discriminatedUnion("status", [
    z.object({
      status: z.literal(ToolResultStatus.Succeeded),
      data: z.unknown().optional(),
    }),
    z.object({
      status: z.literal(ToolResultStatus.Failed),
      code: z.string(),
      message: z.string(),
    }),
    z.object({
      status: z.literal(ToolResultStatus.Unknown),
      code: z.string(),
      message: z.string(),
    }),
  ]),
});

export const ChatResponseProgressEventDTO = z.discriminatedUnion("type", [
  ReasoningDeltaEventDTO,
  ToolCallEventDTO,
  ToolResultEventDTO,
]);

export type ChatResponseProgressEventDTO = z.infer<
  typeof ChatResponseProgressEventDTO
>;

export const WebChatResponseEventDTO = z.discriminatedUnion("type", [
  ReasoningDeltaEventDTO,
  ToolCallEventDTO,
  ToolResultEventDTO,
  z.object({
    type: z.literal("snapshot"),
    chat: ChatMessagesResponseDTO,
  }),
  z.object({
    type: z.literal("error"),
    message: z.string().min(1),
  }),
]);

export type WebChatResponseEventDTO = z.infer<typeof WebChatResponseEventDTO>;

export const SendWebMessageRequestDTO = z.union([
  z.object({
    text: z.string().trim().min(1),
    clientMessageId: z.string().uuid(),
  }),
  z.object({
    buttonReply: z.string().trim().min(1),
    clientMessageId: z.string().uuid(),
  }),
]);

export type SendWebMessageRequestDTO = z.infer<typeof SendWebMessageRequestDTO>;
