export type ChatMessage = {
  id: string;
  type: "text" | "interactive" | "audio";
  userType: "user" | "bot";
  text?: string;
  buttonReply?: string;
  buttonReplyOptions?: string[];
  mediaUrl?: string;
  mimeType?: string;
  transcript?: string;
  createdAt: string;
};
