export const MessageType = {
  Text: "Text",
  ButtonReply: "Interactive",
  Audio: "Audio",
} as const;
export type MessageType = ValueOf<typeof MessageType>;
