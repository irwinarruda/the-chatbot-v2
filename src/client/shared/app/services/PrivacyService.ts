import type { StateCreator } from "zustand";
import { container } from "~/client/shared/container";

export type PrivacyService = {
  isMoneyHidden: boolean;
  isMoneyPrivacyHydrated: boolean;
  hydrateMoneyPrivacy: () => void;
  toggleMoneyVisibility: () => void;
};

export const createPrivacyService: StateCreator<PrivacyService> = (
  set,
  get,
) => ({
  isMoneyHidden: false,
  isMoneyPrivacyHydrated: false,
  hydrateMoneyPrivacy() {
    const { isMoneyPrivacyHydrated } = get();
    if (isMoneyPrivacyHydrated) return;
    set({
      isMoneyHidden: container
        .get("MonetaryPrivacyGateway")
        .resolveIsMoneyHidden(),
      isMoneyPrivacyHydrated: true,
    });
  },
  toggleMoneyVisibility() {
    const { isMoneyHidden, isMoneyPrivacyHydrated } = get();
    const privacyGateway = container.get("MonetaryPrivacyGateway");
    let currentValue = isMoneyHidden;
    if (!isMoneyPrivacyHydrated) {
      currentValue = privacyGateway.resolveIsMoneyHidden();
    }
    const nextValue = !currentValue;
    privacyGateway.persistIsMoneyHidden(nextValue);
    set({ isMoneyHidden: nextValue, isMoneyPrivacyHydrated: true });
  },
});
