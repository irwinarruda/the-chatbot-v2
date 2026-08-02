import type { Credential } from "@earendil-works/pi-ai";
import { AiCredentialEncryption } from "~/modules/chat/gateway/AiCredentialStore/AiCredentialEncryption";

describe("AiCredentialEncryption", () => {
  test("round trips provider credentials without exposing their secrets", () => {
    const encryption = createEncryption();
    const credential = {
      type: "oauth",
      access: "codex-access-token",
      refresh: "codex-refresh-token",
      expires: 2_000_000_000_000,
      accountId: "account-123",
    } satisfies Credential;

    const envelope = encryption.encrypt(
      credential,
      "b902614f-4b44-45ee-8990-f9d58566bb1b",
      "openai-codex",
    );

    expect(JSON.stringify(envelope)).not.toContain("codex-access-token");
    expect(JSON.stringify(envelope)).not.toContain("codex-refresh-token");
    expect(
      encryption.decrypt(
        envelope,
        "b902614f-4b44-45ee-8990-f9d58566bb1b",
        "openai-codex",
      ),
    ).toEqual(credential);
  });

  test("binds an envelope to its user and provider", () => {
    const encryption = createEncryption();
    const envelope = encryption.encrypt(
      { type: "api_key", key: "zai-key" },
      "c433048b-d626-4e57-b40c-373135661380",
      "zai",
    );

    expect(() =>
      encryption.decrypt(
        envelope,
        "c433048b-d626-4e57-b40c-373135661380",
        "openai-codex",
      ),
    ).toThrow("Stored AI provider credential could not be decrypted");
    expect(() =>
      encryption.decrypt(
        envelope,
        "7f95aa11-8129-4be6-99cf-c7ef51f06864",
        "zai",
      ),
    ).toThrow("Stored AI provider credential could not be decrypted");
  });

  test("rejects invalid key lengths and credential shapes", () => {
    expect(() => new AiCredentialEncryption("not-a-key")).toThrow(
      "must decode to exactly 32 bytes",
    );
    expect(() =>
      createEncryption().encrypt(
        {
          type: "oauth",
          access: "access",
          refresh: "refresh",
        } as Credential,
        "d3f607ee-8022-4fe2-a467-74635c26f7c7",
        "openai-codex",
      ),
    ).toThrow();
  });
});

function createEncryption(): AiCredentialEncryption {
  return new AiCredentialEncryption(Buffer.alloc(32, 7).toString("base64"));
}
