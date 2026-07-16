import type { StateCreator } from "zustand";
import type { HydratePrefsDTO } from "~/shared/client/entities/dtos/HydratePrefsDTO";
import type { Locale } from "~/shared/client/i18n";
import type { PrefsDTO, ThemeDTO } from "~/shared/client/services/prefsService";
import {
  DEFAULT_PREFS,
  prefsService,
} from "~/shared/client/services/prefsService";

export type { PrefsDTO, ThemeDTO };

export type PrefsSlice = {
  prefs: PrefsDTO;
  isPrefsHydrated: boolean;
  hydratePrefs: (dto: HydratePrefsDTO) => void;
  toggleTheme: () => Promise<void>;
  toggleLocale: () => Promise<Locale>;
};

export const prefsSlice: StateCreator<PrefsSlice> = (set, get) => ({
  prefs: DEFAULT_PREFS,
  isPrefsHydrated: false,
  hydratePrefs(dto) {
    const { isPrefsHydrated } = get();
    if (isPrefsHydrated) return;
    set({ prefs: dto, isPrefsHydrated: true });
  },
  async toggleTheme() {
    const { prefs } = get();
    const next: PrefsDTO = {
      ...prefs,
      theme: prefs.theme === "light" ? "dark" : "light",
    };
    prefsService.persistPrefs(next);
    set({ prefs: next });
  },
  async toggleLocale() {
    const { prefs } = get();
    const next: PrefsDTO = {
      ...prefs,
      locale: prefs.locale === "pt-BR" ? "en" : "pt-BR",
    };
    prefsService.persistPrefs(next);
    set({ prefs: next });
    return next.locale;
  },
});
