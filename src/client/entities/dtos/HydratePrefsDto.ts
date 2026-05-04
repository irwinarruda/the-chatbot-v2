import type { Locale } from "~/client/i18n";

export type HydratePrefsDto = {
  locale: Locale;
  theme: "light" | "dark";
};
