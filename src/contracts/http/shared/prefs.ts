import { z } from "zod";

export const PrefsDTO = z.object({
  locale: z.enum(["pt-BR", "en"]),
  theme: z.enum(["light", "dark"]),
  palette: z.enum(["barro", "favo"]).default("barro"),
});

export type PrefsDTO = z.infer<typeof PrefsDTO>;
export type ThemeDTO = PrefsDTO["theme"];
