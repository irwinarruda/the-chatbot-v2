export const ChatType = {
  WhatsApp: "WhatsApp",
  Web: "Web",
} as const;
export type ChatType = ValueOf<typeof ChatType>;
