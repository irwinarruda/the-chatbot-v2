import type { HydratePrefsDto } from "~/client/entities/dtos/HydratePrefsDto";
import type { Locale } from "~/client/i18n";
import { DEFAULT_LOCALE } from "~/client/i18n";
import type { Theme } from "~/client/services/prefsService";
import { prefsService } from "~/client/services/prefsService";
import type { AppState } from "~/client/stores/types";

export type { Theme };

export type PrefsSlice = {
  locale: Locale;
  theme: Theme;
  isPrefsHydrated: boolean;

  hydratePrefs: (dto: HydratePrefsDto) => void;
  toggleTheme: () => Promise<void>;
  toggleLocale: () => Promise<Locale>;
};

export const prefsSlice: AppState<PrefsSlice> = (set, get) => ({
  locale: DEFAULT_LOCALE,
  theme: "dark",
  isPrefsHydrated: false,

  hydratePrefs(dto) {
    const state = get();
    if (
      state.isPrefsHydrated &&
      state.locale === dto.locale &&
      state.theme === dto.theme
    ) {
      return;
    }
    set({ locale: dto.locale, theme: dto.theme, isPrefsHydrated: true });
  },

  async toggleTheme() {
    const next: Theme = get().theme === "light" ? "dark" : "light";
    prefsService.applyTheme(next);
    prefsService.persistTheme(next);
    set({ theme: next });
  },

  async toggleLocale() {
    const next: Locale = get().locale === "pt-BR" ? "en" : "pt-BR";
    await prefsService.persistLocale(next);
    set({ locale: next });
    return next;
  },
});
