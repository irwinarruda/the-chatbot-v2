export const ChatChannel = {
  WhatsApp: "WhatsApp",
  Web: "Web",
} as const;
export type ChatChannel = ValueOf<typeof ChatChannel>;
