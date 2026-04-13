export const ChatType = {
  WhatsApp: "WhatsApp",
} as const;
export type ChatType = ValueOf<typeof ChatType>;
