const STORAGE_KEY = "the-chatbot.monetary-values-hidden";

export const monetaryPrivacyService = {
  resolveIsMoneyHidden(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  },

  persistIsMoneyHidden(isMoneyHidden: boolean): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(isMoneyHidden));
  },
};
