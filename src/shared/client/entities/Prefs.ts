import type { Locale } from "~/shared/client/i18n";

export type Theme = "light" | "dark";

export type Prefs = {
  locale: Locale;
  theme: Theme;
};
