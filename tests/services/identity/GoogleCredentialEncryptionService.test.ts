import { Credential } from "~/modules/identity/entities/Credentials";
import { GoogleCredentialEncryptionService } from "~/modules/identity/services/GoogleCredentialEncryptionService";

describe("GoogleCredentialEncryptionService", () => {
  test("round-trips both tokens with nondeterministic ciphertext", () => {
    const service = createService();
    const credential = createCredential();

    const first = service.encrypt(credential);
    const second = service.encrypt(credential);

    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.authenticationTag).not.toBe(second.authenticationTag);
    expect(service.decrypt(first, credential.id, credential.idUser)).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  test("rejects tampering and a different credential identity", () => {
    const service = createService();
    const credential = createCredential();
    const encrypted = service.encrypt(credential);

    expect(() =>
      service.decrypt(
        {
          ...encrypted,
          ciphertext: Buffer.from("tampered").toString("base64"),
        },
        credential.id,
        credential.idUser,
      ),
    ).toThrow("Stored Google credential could not be decrypted");
    expect(() =>
      service.decrypt(encrypted, credential.id, "another-user"),
    ).toThrow("Stored Google credential could not be decrypted");
  });
});

function createService(): GoogleCredentialEncryptionService {
  return new GoogleCredentialEncryptionService(
    Buffer.alloc(32, 1).toString("base64"),
  );
}

function createCredential(): Credential {
  const credential = new Credential();
  credential.idUser = "user-id";
  credential.accessToken = "access-token";
  credential.refreshToken = "refresh-token";
  return credential;
}
