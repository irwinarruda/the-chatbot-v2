import type { Credential, CredentialInfo } from "@earendil-works/pi-ai";

export interface AiCredentialStore {
  read(providerId: string): Promise<Credential | undefined>;
  list(): Promise<readonly CredentialInfo[]>;
  modify(
    providerId: string,
    update: (
      current: Credential | undefined,
    ) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined>;
  delete(providerId: string): Promise<void>;
}
