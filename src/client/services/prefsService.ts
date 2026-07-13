import { CookieParser } from "~/client/utils/CookieParser";
import {
  PREFS_COOKIE_NAME,
  type Prefs,
  resolvePrefs,
  type Theme,
} from "~/shared/contracts/PrefsContract";

export { DEFAULT_PREFS } from "~/shared/contracts/PrefsContract";
export type { Prefs, Theme };

const PREFS_COOKIE_MAX_AGE_SECONDS = 31536000;

export const prefsService = {
  resolvePrefs,

  persistPrefs(prefs: Prefs): void {
    if (typeof document === "undefined") return;
    document.documentElement.lang = prefs.locale;
    document.documentElement.dataset.theme = prefs.theme;
    CookieParser.set(PREFS_COOKIE_NAME, JSON.stringify(prefs), {
      maxAge: PREFS_COOKIE_MAX_AGE_SECONDS,
    });
  },
};
