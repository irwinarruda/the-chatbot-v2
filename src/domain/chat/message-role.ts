export const MessageRole = {
  User: "User",
  Assistant: "Assistant",
  Tool: "Tool",
} as const;
export type MessageRole = ValueOf<typeof MessageRole>;
