import { googleCredentialEncryptionConfigSchema } from "~/shared/config/Config";

describe("GoogleCredentialEncryptionConfig", () => {
  test("accepts one base64-encoded 32-byte key", () => {
    const result = googleCredentialEncryptionConfigSchema.safeParse({
      key: Buffer.alloc(32, 1).toString("base64"),
    });

    expect(result.success).toBe(true);
  });

  test("rejects missing keys and invalid key lengths", () => {
    const invalidLength = googleCredentialEncryptionConfigSchema.safeParse({
      key: Buffer.alloc(16).toString("base64"),
    });
    const missingKey = googleCredentialEncryptionConfigSchema.safeParse({});

    expect(invalidLength.success).toBe(false);
    expect(missingKey.success).toBe(false);
  });
});
