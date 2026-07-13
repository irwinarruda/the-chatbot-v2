export type SendWebMessageDto =
  | { text: string; buttonReply?: never; clientMessageId: string }
  | { text?: never; buttonReply: string; clientMessageId: string };
