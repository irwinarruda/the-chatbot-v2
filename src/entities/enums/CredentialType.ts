export const CredentialType = {
  Google: "Google",
} as const;
export type CredentialType = ValueOf<typeof CredentialType>;
