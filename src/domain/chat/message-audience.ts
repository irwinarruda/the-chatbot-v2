export const MessageAudience = {
  Channel: "Channel",
  Model: "Model",
  Both: "Both",
} as const;
export type MessageAudience = ValueOf<typeof MessageAudience>;
