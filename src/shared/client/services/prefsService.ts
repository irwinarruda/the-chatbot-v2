import { CookieParser } from "~/shared/client/utils/CookieParser";
import type { PrefsDTO, ThemeDTO } from "~/shared/entities/dtos/PrefsDTO";
import { PREFS_COOKIE_NAME, resolvePrefs } from "~/shared/utils/PrefsUtils";

export { DEFAULT_PREFS } from "~/shared/utils/PrefsUtils";
export type { PrefsDTO, ThemeDTO };

const PREFS_COOKIE_MAX_AGE_SECONDS = 31536000;

export const prefsService = {
  resolvePrefs,

  persistPrefs(prefs: PrefsDTO): void {
    if (typeof document === "undefined") return;
    document.documentElement.lang = prefs.locale;
    document.documentElement.dataset.theme = prefs.theme;
    CookieParser.set(PREFS_COOKIE_NAME, JSON.stringify(prefs), {
      maxAge: PREFS_COOKIE_MAX_AGE_SECONDS,
    });
  },
};
