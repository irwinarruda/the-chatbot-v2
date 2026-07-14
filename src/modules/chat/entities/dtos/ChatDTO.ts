import { z } from "zod";

export const ChannelMessageResponse = z.object({
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

export type ChannelMessageResponse = z.infer<typeof ChannelMessageResponse>;
export type ChatMessage = ChannelMessageResponse;

export const ChatMessagesResponse = z.object({
  messages: z.array(ChannelMessageResponse),
});

export type ChatMessagesResponse = z.infer<typeof ChatMessagesResponse>;

export const SendWebMessageRequest = z.union([
  z.object({
    text: z.string().trim().min(1),
    clientMessageId: z.string().uuid(),
  }),
  z.object({
    buttonReply: z.string().trim().min(1),
    clientMessageId: z.string().uuid(),
  }),
]);

export type SendWebMessageRequest = z.infer<typeof SendWebMessageRequest>;
