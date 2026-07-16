import { z } from "zod";

export const ChannelMessageResponseDTO = z.object({
  id: z.string().uuid(),
  clientMessageId: z.string().min(1).optional(),
  type: z.enum(["text", "interactive", "audio"]),
  userType: z.enum(["user", "bot"]),
  text: z.string().optional(),
  buttonReply: z.string().optional(),
  buttonReplyOptions: z.array(z.string()).optional(),
  mediaUrl: z.string().optional(),
  mimeType: z.string().optional(),
  transcript: z.string().optional(),
  createdAt: z.iso.datetime(),
});

export type ChannelMessageResponseDTO = z.infer<
  typeof ChannelMessageResponseDTO
>;
export type ChatMessageDTO = ChannelMessageResponseDTO;

export const ChatMessagesResponseDTO = z.object({
  messages: z.array(ChannelMessageResponseDTO),
});

export type ChatMessagesResponseDTO = z.infer<typeof ChatMessagesResponseDTO>;

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
