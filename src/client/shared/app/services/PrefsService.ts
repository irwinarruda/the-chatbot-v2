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
  togglePalette: () => Promise<void>;
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
    set({
      prefs: savePrefs({
        ...prefs,
        theme: prefs.theme === "light" ? "dark" : "light",
      }),
    });
  },
  async togglePalette() {
    const { prefs } = get();
    set({
      prefs: savePrefs({
        ...prefs,
        palette: prefs.palette === "favo" ? "barro" : "favo",
      }),
    });
  },
  async toggleLocale() {
    const { prefs } = get();
    const next = savePrefs({
      ...prefs,
      locale: prefs.locale === "pt-BR" ? "en" : "pt-BR",
    });
    set({ prefs: next });
    return next.locale;
  },
});

function savePrefs(prefs: PrefsDTO) {
  container.get("PrefsGateway").persistPrefs(prefs);
  return prefs;
}
