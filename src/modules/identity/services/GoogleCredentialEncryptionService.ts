import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Credential } from "~/modules/identity/entities/Credentials";
import {
  GoogleCredentialEnvelopeDTO,
  GoogleCredentialSecretDTO,
} from "~/modules/identity/entities/dtos/GoogleCredentialSecretsDTO";

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;

export class GoogleCredentialEncryptionService {
  private key: Buffer;

  constructor(key: string) {
    this.key = Buffer.from(key, "base64");
  }

  encrypt(credential: Credential): GoogleCredentialEnvelopeDTO {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, nonce);
    cipher.setAAD(this.createAssociatedData(credential.id, credential.idUser));
    const plaintext = JSON.stringify({
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
    } satisfies GoogleCredentialSecretDTO);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return {
      nonce: nonce.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      authenticationTag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(
    envelope: unknown,
    credentialId: string,
    idUser: string,
  ): GoogleCredentialSecretDTO {
    try {
      const parsedEnvelope = GoogleCredentialEnvelopeDTO.parse(envelope);
      const nonce = Buffer.from(parsedEnvelope.nonce, "base64");
      if (nonce.length !== NONCE_BYTES) {
        throw new Error("Invalid Google credential nonce");
      }
      const decipher = createDecipheriv(ALGORITHM, this.key, nonce);
      decipher.setAAD(this.createAssociatedData(credentialId, idUser));
      decipher.setAuthTag(
        Buffer.from(parsedEnvelope.authenticationTag, "base64"),
      );
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(parsedEnvelope.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
      return GoogleCredentialSecretDTO.parse(JSON.parse(plaintext));
    } catch {
      throw new Error("Stored Google credential could not be decrypted");
    }
  }

  private createAssociatedData(credentialId: string, idUser: string): Buffer {
    return Buffer.from(`${idUser}\0${credentialId}`, "utf8");
  }
}
