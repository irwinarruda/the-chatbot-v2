import type { StateCreator } from "zustand";
import type { HydratePrefsDTO } from "~/client/shared/app/dtos/HydratePrefsDTO";
import { container } from "~/client/shared/container";
import type { Locale } from "~/client/shared/i18n/dictionary";
import type { PrefsDTO } from "~/contracts/http/shared/prefs";
import { DEFAULT_PREFS } from "~/contracts/http/shared/prefs-cookie";

export type PrefsService = {
  prefs: PrefsDTO;
  isPrefsHydrated: boolean;
  hydratePrefs: (dto: HydratePrefsDTO) => void;
  toggleTheme: () => Promise<void>;
  toggleLocale: () => Promise<Locale>;
};

export const createPrefsService: StateCreator<PrefsService> = (set, get) => ({
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
    container.get("PrefsGateway").persistPrefs(next);
    set({ prefs: next });
  },
  async toggleLocale() {
    const { prefs } = get();
    const next: PrefsDTO = {
      ...prefs,
      locale: prefs.locale === "pt-BR" ? "en" : "pt-BR",
    };
    container.get("PrefsGateway").persistPrefs(next);
    set({ prefs: next });
    return next.locale;
  },
});
