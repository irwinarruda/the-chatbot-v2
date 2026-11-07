import type { PrefsGateway } from "~/client/shared/app/gateways/PrefsGateway";
import { CookieParser } from "~/client/shared/utils/CookieParser";
import type { PrefsDTO } from "~/contracts/http/shared/prefs";
import { PREFS_COOKIE_NAME } from "~/contracts/http/shared/prefs-cookie";

const PREFS_COOKIE_MAX_AGE_SECONDS = 31536000;

export const cookiePrefsGateway: PrefsGateway = {
  persistPrefs(prefs: PrefsDTO): void {
    if (typeof document === "undefined") return;
    document.documentElement.lang = prefs.locale;
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.dataset.palette = prefs.palette;
    CookieParser.set(PREFS_COOKIE_NAME, JSON.stringify(prefs), {
      maxAge: PREFS_COOKIE_MAX_AGE_SECONDS,
    });
  },
};
