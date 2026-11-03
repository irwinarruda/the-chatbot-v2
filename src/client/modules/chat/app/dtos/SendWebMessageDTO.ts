export type SendWebMessageDTO =
  | { text: string; buttonReply?: never; clientMessageId: string }
  | { text?: never; buttonReply: string; clientMessageId: string };
