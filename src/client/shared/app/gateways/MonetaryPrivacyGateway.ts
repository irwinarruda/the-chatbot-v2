export interface MonetaryPrivacyGateway {
  resolveIsMoneyHidden(): boolean;
  persistIsMoneyHidden(isMoneyHidden: boolean): void;
}
