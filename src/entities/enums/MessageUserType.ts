export const MessageUserType = {
  User: "user",
  Bot: "bot",
} as const;
export type MessageUserType = ValueOf<typeof MessageUserType>;
