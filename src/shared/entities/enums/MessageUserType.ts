export const MessageUserType = {
  User: "User",
  Bot: "Bot",
} as const;
export type MessageUserType = ValueOf<typeof MessageUserType>;
