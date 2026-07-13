import en from "./en.json";
import ptBR from "./pt-BR.json";

export type Locale = "en" | "pt-BR";

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  "pt-BR": ptBR,
};

export const DEFAULT_LOCALE: Locale = "pt-BR";

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "pt-BR";
}
