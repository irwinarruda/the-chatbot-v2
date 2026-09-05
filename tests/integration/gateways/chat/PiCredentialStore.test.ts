import { describe, expect, test } from "vitest";
import type { AiProviderCredentialDTO } from "~/modules/chat/entities/dtos/AiProviderCredentialDTO";
import { createPiCredentialStore } from "~/modules/chat/gateway/AiChatGateway/PiCredentialStore";
import type { AiCredentialStore } from "~/modules/chat/gateway/AiCredentialStore";

function createStore(credential: AiProviderCredentialDTO) {
  let current: AiProviderCredentialDTO | undefined = credential;
  const store: AiCredentialStore = {
    read: async () => current,
    list: async () => {
      if (!current) return [];
      return [{ providerId: "provider", type: current.type }];
    },
    modify: async (_providerId, update) => {
      const next = await update(current);
      if (next !== undefined) current = next;
      return current;
    },
    delete: async () => {
      current = undefined;
    },
  };
  return { store, adapter: createPiCredentialStore(store) };
}

describe("Pi credential adapter", () => {
  test("preserves provider environment and unchanged credentials", async () => {
    const credential: AiProviderCredentialDTO = {
      type: "api_key",
      key: "test-key",
      env: { ACCOUNT_ID: "test-account", REGION: "test-region" },
    };
    const { adapter } = createStore(credential);
    await expect(adapter.read("provider")).resolves.toEqual(credential);
    await expect(adapter.list()).resolves.toEqual([
      { providerId: "provider", type: "api_key" },
    ]);
    await expect(
      adapter.modify("provider", async () => undefined),
    ).resolves.toEqual(credential);
    await adapter.delete("provider");
    await expect(adapter.read("provider")).resolves.toBeUndefined();
    await expect(adapter.list()).resolves.toEqual([]);
  });

  test("refreshes OAuth tokens inside the owned update callback without dropping provider fields", async () => {
    const original: AiProviderCredentialDTO = {
      type: "oauth",
      access: "expired-access",
      refresh: "original-refresh",
      expires: 0,
      accountId: "account-123",
      providerData: { organization: "organization-456" },
    };
    const { adapter, store } = createStore(original);
    const result = await adapter.modify("provider", async (current) => {
      expect(current).toEqual(original);
      if (current?.type !== "oauth")
        throw new Error("Expected OAuth credential");
      return {
        ...current,
        access: "new-access",
        refresh: "new-refresh",
        expires: 123_456,
      };
    });
    expect(result).toEqual({
      ...original,
      access: "new-access",
      refresh: "new-refresh",
      expires: 123_456,
    });
    await expect(store.read("provider")).resolves.toEqual(result);
  });

  test("rejects invalid SDK updates before replacing the stored credential", async () => {
    const original: AiProviderCredentialDTO = {
      type: "api_key",
      key: "original-key",
    };
    const { adapter, store } = createStore(original);
    await expect(
      adapter.modify("provider", async () => ({
        type: "oauth",
        access: "access",
        refresh: "refresh",
        expires: Number.NaN,
      })),
    ).rejects.toThrow();
    await expect(store.read("provider")).resolves.toEqual(original);
  });
});
