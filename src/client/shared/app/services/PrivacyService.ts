import type { StateCreator } from "zustand";
import type { MonetaryPrivacyGateway } from "~/client/shared/app/gateways/MonetaryPrivacyGateway";

export type PrivacyService = {
  isMoneyHidden: boolean;
  isMoneyPrivacyHydrated: boolean;
  hydrateMoneyPrivacy: () => void;
  toggleMoneyVisibility: () => void;
};

export function createPrivacyService(
  privacy: MonetaryPrivacyGateway,
): StateCreator<PrivacyService> {
  return (set, get) => ({
    isMoneyHidden: false,
    isMoneyPrivacyHydrated: false,
    hydrateMoneyPrivacy() {
      const { isMoneyPrivacyHydrated } = get();
      if (isMoneyPrivacyHydrated) return;
      set({
        isMoneyHidden: privacy.resolveIsMoneyHidden(),
        isMoneyPrivacyHydrated: true,
      });
    },
    toggleMoneyVisibility() {
      const { isMoneyHidden, isMoneyPrivacyHydrated } = get();
      let currentValue = isMoneyHidden;
      if (!isMoneyPrivacyHydrated) {
        currentValue = privacy.resolveIsMoneyHidden();
      }
      const nextValue = !currentValue;
      privacy.persistIsMoneyHidden(nextValue);
      set({ isMoneyHidden: nextValue, isMoneyPrivacyHydrated: true });
    },
  });
}
