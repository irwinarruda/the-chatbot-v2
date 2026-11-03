import type {
  AiProviderCredentialDTO,
  AiProviderCredentialInfoDTO,
} from "~/domain/chat/ai-provider-credential";

export interface AiCredentialStore {
  read(providerId: string): Promise<AiProviderCredentialDTO | undefined>;
  list(): Promise<readonly AiProviderCredentialInfoDTO[]>;
  modify(
    providerId: string,
    update: (
      current: AiProviderCredentialDTO | undefined,
    ) => Promise<AiProviderCredentialDTO | undefined>,
  ): Promise<AiProviderCredentialDTO | undefined>;
  delete(providerId: string): Promise<void>;
}
