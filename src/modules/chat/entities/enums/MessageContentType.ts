export const MessageContentType = {
  Text: "text",
  Button: "button",
  Audio: "audio",
  Command: "command",
  Reasoning: "reasoning",
  ToolCall: "toolCall",
  ToolResult: "toolResult",
} as const;
export type MessageContentType = ValueOf<typeof MessageContentType>;
