import type { Credential } from "@earendil-works/pi-ai";
import { Database } from "~/infra/database";
import { AiCredentialEncryption } from "~/modules/chat/gateway/AiCredentialStore/AiCredentialEncryption";
import { PostgresAiCredentialStore } from "~/modules/chat/gateway/AiCredentialStore/PostgresAiCredentialStore";
import { orquestrator } from "~/tests/orquestrator";

describe("PostgresAiCredentialStore", () => {
  beforeEach(async () => {
    await orquestrator.clearDatabase();
  });

  test("persists, lists, replaces, and deletes provider credentials", async () => {
    const user = await orquestrator.createUser();
    const store = createStore(orquestrator.database, user.id);

    expect(await store.read("zai")).toBeUndefined();
    expect(
      await store.modify("zai", async () => ({
        type: "api_key",
        key: "zai-secret",
      })),
    ).toEqual({ type: "api_key", key: "zai-secret" });
    expect(await store.read("zai")).toEqual({
      type: "api_key",
      key: "zai-secret",
    });
    expect(await store.list()).toEqual([
      { providerId: "zai", type: "api_key" },
    ]);

    const unchanged = await store.modify("zai", async () => undefined);
    expect(unchanged).toEqual({ type: "api_key", key: "zai-secret" });

    const oauth = createExpiredOAuthCredential();
    await store.modify("openai-codex", async () => oauth);
    expect(await store.list()).toEqual([
      { providerId: "openai-codex", type: "oauth" },
      { providerId: "zai", type: "api_key" },
    ]);

    const rows = await orquestrator.database.sql<
      { credential_envelope: unknown }[]
    >`
      SELECT credential_envelope
      FROM ai_provider_credentials
      WHERE id_user = ${user.id}
        AND provider_id = ${"zai"}
    `;
    expect(JSON.stringify(rows[0]?.credential_envelope)).not.toContain(
      "zai-secret",
    );

    await store.delete("zai");
    expect(await store.read("zai")).toBeUndefined();
  });

  test("does not decrypt credentials while listing metadata", async () => {
    const user = await orquestrator.createUser();
    const store = createStore(orquestrator.database, user.id);
    await store.modify("zai", async () => ({
      type: "api_key",
      key: "zai-secret",
    }));
    await orquestrator.database.sql`
      UPDATE ai_provider_credentials
      SET credential_envelope = ${orquestrator.database.json({ broken: true })}
      WHERE id_user = ${user.id}
        AND provider_id = ${"zai"}
    `;

    expect(await store.list()).toEqual([
      { providerId: "zai", type: "api_key" },
    ]);
    await expect(store.read("zai")).rejects.toThrow(
      "Stored AI provider credential could not be decrypted",
    );
  });

  test("rolls back when a credential update fails", async () => {
    const user = await orquestrator.createUser();
    const store = createStore(orquestrator.database, user.id);
    await store.modify("zai", async () => ({
      type: "api_key",
      key: "original-key",
    }));

    await expect(
      store.modify("zai", async () => {
        throw new Error("refresh failed");
      }),
    ).rejects.toThrow("refresh failed");
    expect(await store.read("zai")).toEqual({
      type: "api_key",
      key: "original-key",
    });
  });

  test("serializes an OAuth refresh across database clients", async () => {
    const user = await orquestrator.createUser();
    const firstStore = createStore(orquestrator.database, user.id);
    await firstStore.modify("openai-codex", async () =>
      createExpiredOAuthCredential(),
    );
    const secondDatabase = new Database(
      orquestrator.databaseConfig.connectionString,
      { onnotice: () => {} },
    );
    const secondStore = createStore(secondDatabase, user.id);
    let refreshCount = 0;
    const refresh = async (
      current: Credential | undefined,
    ): Promise<Credential | undefined> => {
      if (current?.type !== "oauth" || Date.now() < current.expires) {
        return undefined;
      }
      refreshCount += 1;
      await wait(30);
      return {
        ...current,
        access: "refreshed-access",
        refresh: "rotated-refresh",
        expires: Date.now() + 60_000,
      };
    };

    try {
      const results = await Promise.all([
        firstStore.modify("openai-codex", refresh),
        secondStore.modify("openai-codex", refresh),
      ]);

      expect(refreshCount).toBe(1);
      expect(results).toEqual([
        expect.objectContaining({ access: "refreshed-access" }),
        expect.objectContaining({ access: "refreshed-access" }),
      ]);
    } finally {
      await secondDatabase.close();
    }
  });

  test("serializes creation when the provider has no credential row", async () => {
    const user = await orquestrator.createUser();
    const firstStore = createStore(orquestrator.database, user.id);
    const secondDatabase = new Database(
      orquestrator.databaseConfig.connectionString,
      { onnotice: () => {} },
    );
    const secondStore = createStore(secondDatabase, user.id);
    let creationCount = 0;
    const create = async (
      current: Credential | undefined,
    ): Promise<Credential | undefined> => {
      if (current) return undefined;
      creationCount += 1;
      await wait(30);
      return { type: "api_key", key: "created-once" };
    };

    try {
      const results = await Promise.all([
        firstStore.modify("zai", create),
        secondStore.modify("zai", create),
      ]);

      expect(creationCount).toBe(1);
      expect(results).toEqual([
        { type: "api_key", key: "created-once" },
        { type: "api_key", key: "created-once" },
      ]);
    } finally {
      await secondDatabase.close();
    }
  });

  test("removes provider credentials when their user is deleted", async () => {
    const user = await orquestrator.createUser();
    const store = createStore(orquestrator.database, user.id);
    await store.modify("zai", async () => ({
      type: "api_key",
      key: "zai-secret",
    }));

    await orquestrator.database.sql`DELETE FROM users WHERE id = ${user.id}`;

    expect(await store.list()).toEqual([]);
  });
});

function createStore(
  database: Database,
  idUser: string,
): PostgresAiCredentialStore {
  return new PostgresAiCredentialStore(
    database,
    new AiCredentialEncryption(Buffer.alloc(32, 9).toString("base64")),
    idUser,
  );
}

function createExpiredOAuthCredential(): Credential {
  return {
    type: "oauth",
    access: "expired-access",
    refresh: "refresh-token",
    expires: 0,
    accountId: "account-123",
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
