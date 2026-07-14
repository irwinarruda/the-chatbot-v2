export const MessageContentType = {
  Text: "text",
  Button: "button",
  Audio: "audio",
  ToolCall: "toolCall",
  ToolResult: "toolResult",
} as const;
export type MessageContentType = ValueOf<typeof MessageContentType>;
