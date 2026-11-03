import type { CredentialStore } from "@earendil-works/pi-ai";
import { AiProviderCredentialDTO } from "~/domain/chat/ai-provider-credential";
import type { AiCredentialStore } from "./ai-credential-store";

export function createPiCredentialStore(
  store: AiCredentialStore,
): CredentialStore {
  return {
    read: (providerId) => store.read(providerId),
    list: () => store.list(),
    modify: (providerId, update) =>
      store.modify(providerId, async (current) => {
        const credential = await update(current);
        if (credential === undefined) return undefined;
        return AiProviderCredentialDTO.parse(credential);
      }),
    delete: (providerId) => store.delete(providerId),
  };
}
