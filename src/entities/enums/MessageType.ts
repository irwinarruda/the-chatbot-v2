export const MessageType = {
  Text: "text",
  ButtonReply: "interactive",
  Audio: "audio",
} as const;
export type MessageType = ValueOf<typeof MessageType>;
