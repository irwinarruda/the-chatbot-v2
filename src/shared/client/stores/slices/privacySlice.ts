import type { StateCreator } from "zustand";
import { monetaryPrivacyService } from "~/shared/client/services/monetaryPrivacyService";

export type PrivacySlice = {
  isMoneyHidden: boolean;
  isMoneyPrivacyHydrated: boolean;
  hydrateMoneyPrivacy: () => void;
  toggleMoneyVisibility: () => void;
};

export const privacySlice: StateCreator<PrivacySlice> = (set, get) => ({
  isMoneyHidden: false,
  isMoneyPrivacyHydrated: false,
  hydrateMoneyPrivacy() {
    const { isMoneyPrivacyHydrated } = get();
    if (isMoneyPrivacyHydrated) return;
    set({
      isMoneyHidden: monetaryPrivacyService.resolveIsMoneyHidden(),
      isMoneyPrivacyHydrated: true,
    });
  },
  toggleMoneyVisibility() {
    const { isMoneyHidden, isMoneyPrivacyHydrated } = get();
    let currentValue = isMoneyHidden;
    if (!isMoneyPrivacyHydrated) {
      currentValue = monetaryPrivacyService.resolveIsMoneyHidden();
    }
    const nextValue = !currentValue;
    monetaryPrivacyService.persistIsMoneyHidden(nextValue);
    set({ isMoneyHidden: nextValue, isMoneyPrivacyHydrated: true });
  },
});
