import type { Locale } from "~/client/shared/i18n/dictionary";

export type Theme = "light" | "dark";

export type Prefs = {
  locale: Locale;
  theme: Theme;
};
