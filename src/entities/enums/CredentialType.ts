export const CredentialType = {
  Google: "google",
} as const;
export type CredentialType = ValueOf<typeof CredentialType>;
