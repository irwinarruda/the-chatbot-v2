import type { HydratePrefsDto } from "~/client/entities/dtos/HydratePrefsDto";
import type { Locale } from "~/client/i18n";
import type { Prefs, Theme } from "~/client/services/prefsService";
import { DEFAULT_PREFS, prefsService } from "~/client/services/prefsService";
import type { AppState } from "~/client/stores";

export type { Prefs, Theme };

export type PrefsSlice = {
  prefs: Prefs;
  isPrefsHydrated: boolean;
  hydratePrefs: (dto: HydratePrefsDto) => void;
  toggleTheme: () => Promise<void>;
  toggleLocale: () => Promise<Locale>;
};

export const prefsSlice: AppState<PrefsSlice> = (set, get) => ({
  prefs: DEFAULT_PREFS,
  isPrefsHydrated: false,
  hydratePrefs(dto) {
    const { isPrefsHydrated } = get();
    if (isPrefsHydrated) return;
    set({ prefs: dto, isPrefsHydrated: true });
  },
  async toggleTheme() {
    const { prefs } = get();
    const next: Prefs = {
      ...prefs,
      theme: prefs.theme === "light" ? "dark" : "light",
    };
    prefsService.applyTheme(next.theme);
    prefsService.persistPrefs(next);
    set({ prefs: next });
  },
  async toggleLocale() {
    const { prefs } = get();
    const next: Prefs = {
      ...prefs,
      locale: prefs.locale === "pt-BR" ? "en" : "pt-BR",
    };
    prefsService.persistPrefs(next);
    set({ prefs: next });
    return next.locale;
  },
});
