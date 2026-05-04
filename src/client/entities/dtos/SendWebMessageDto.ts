export type SendWebMessageDto =
  | { text: string; buttonReply?: never }
  | { text?: never; buttonReply: string };
