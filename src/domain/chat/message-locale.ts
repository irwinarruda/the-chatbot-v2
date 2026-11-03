export const MessageLocale = {
  En: "En",
  PtBr: "PtBr",
} as const;
export type MessageLocale = ValueOf<typeof MessageLocale>;

export function toMessageLocale(locale: string): MessageLocale {
  if (locale === "en") return MessageLocale.En;
  return MessageLocale.PtBr;
}
