import type { Locale } from "~/client/i18n";

export type Theme = "light" | "dark";

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  // biome-ignore lint/suspicious/noDocumentCookie: intentional cookie write for SSR-compatible prefs persistence
  document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

export const prefsService = {
  applyTheme(theme: Theme): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
  },

  persistTheme(theme: Theme): void {
    setCookie("theme", theme);
  },

  async persistLocale(locale: Locale): Promise<void> {
    setCookie("locale", locale);
  },
};
