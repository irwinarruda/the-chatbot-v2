import { z } from "zod";

export const Prefs = z.object({
  locale: z.enum(["pt-BR", "en"]),
  theme: z.enum(["light", "dark"]),
});

export type Prefs = z.infer<typeof Prefs>;
export type Theme = Prefs["theme"];
