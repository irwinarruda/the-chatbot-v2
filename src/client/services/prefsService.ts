import type { Prefs, Theme } from "~/client/entities/Prefs";
import { DEFAULT_LOCALE, isLocale } from "~/client/i18n";
import { CookieParser } from "~/client/utils/CookieParser";

export type { Prefs, Theme };

export const DEFAULT_PREFS: Prefs = {
  locale: DEFAULT_LOCALE,
  theme: "dark",
};

const PREFS_COOKIE_NAME = "the-chatbot-prefs";
const PREFS_COOKIE_MAX_AGE_SECONDS = 31536000;

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function resolvePrefsValue(value: unknown): Prefs {
  if (!value || typeof value !== "object") return DEFAULT_PREFS;

  const prefs = value as Partial<Record<keyof Prefs, unknown>>;
  return {
    locale: isLocale(prefs.locale) ? prefs.locale : DEFAULT_PREFS.locale,
    theme: isTheme(prefs.theme) ? prefs.theme : DEFAULT_PREFS.theme,
  };
}

export const prefsService = {
  resolvePrefs(cookieHeader: string): Prefs {
    const cookies = CookieParser.parse(cookieHeader);
    const rawPrefs = cookies[PREFS_COOKIE_NAME];
    if (!rawPrefs) return DEFAULT_PREFS;

    try {
      return resolvePrefsValue(JSON.parse(rawPrefs));
    } catch {
      return DEFAULT_PREFS;
    }
  },

  applyTheme(theme: Theme): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
  },

  persistPrefs(prefs: Prefs): void {
    CookieParser.set(PREFS_COOKIE_NAME, JSON.stringify(prefs), {
      maxAge: PREFS_COOKIE_MAX_AGE_SECONDS,
    });
  },
};
