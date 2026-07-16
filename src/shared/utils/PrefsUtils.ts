import { PrefsDTO } from "~/shared/entities/dtos/PrefsDTO";

export const DEFAULT_PREFS: PrefsDTO = { locale: "pt-BR", theme: "dark" };
export const PREFS_COOKIE_NAME = "the-chatbot-prefs";

export function parseCookieHeader(header: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((cookie) => {
      const index = cookie.indexOf("=");
      if (index === -1) return [cookie.trim(), ""];
      return [
        cookie.slice(0, index).trim(),
        decodeURIComponent(cookie.slice(index + 1).trim()),
      ];
    }),
  );
}

export function resolvePrefs(cookieHeader: string): PrefsDTO {
  const rawPrefs = parseCookieHeader(cookieHeader)[PREFS_COOKIE_NAME];
  if (!rawPrefs) return DEFAULT_PREFS;
  try {
    const parsed = PrefsDTO.safeParse(JSON.parse(rawPrefs));
    return parsed.success ? parsed.data : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
