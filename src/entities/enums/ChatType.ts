export const ChatType = {
  WhatsApp: "wa_biz",
} as const;
export type ChatType = ValueOf<typeof ChatType>;
