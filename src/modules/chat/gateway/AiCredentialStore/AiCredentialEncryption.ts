import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Credential } from "@earendil-works/pi-ai";
import {
  AiProviderCredentialDTO,
  type AiProviderCredentialEnvelopeDTO as AiProviderCredentialEnvelope,
  AiProviderCredentialEnvelopeDTO,
} from "~/modules/chat/entities/dtos/AiProviderCredentialDTO";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;

export class AiCredentialEncryption {
  private key: Buffer;

  constructor(key: string) {
    this.key = Buffer.from(key, "base64");
    if (this.key.length !== KEY_BYTES) {
      throw new Error(
        "The AI credential encryption key must decode to exactly 32 bytes",
      );
    }
  }

  encrypt(
    credential: Credential,
    idUser: string,
    providerId: string,
  ): AiProviderCredentialEnvelope {
    const parsedCredential = AiProviderCredentialDTO.parse(credential);
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, nonce);
    cipher.setAAD(this.createAssociatedData(idUser, providerId));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(parsedCredential), "utf8"),
      cipher.final(),
    ]);
    return {
      nonce: nonce.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      authenticationTag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(envelope: unknown, idUser: string, providerId: string): Credential {
    try {
      const parsedEnvelope = AiProviderCredentialEnvelopeDTO.parse(envelope);
      const nonce = Buffer.from(parsedEnvelope.nonce, "base64");
      if (nonce.length !== NONCE_BYTES) {
        throw new Error("Invalid AI credential nonce");
      }
      const decipher = createDecipheriv(ALGORITHM, this.key, nonce);
      decipher.setAAD(this.createAssociatedData(idUser, providerId));
      decipher.setAuthTag(
        Buffer.from(parsedEnvelope.authenticationTag, "base64"),
      );
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(parsedEnvelope.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
      return AiProviderCredentialDTO.parse(JSON.parse(plaintext));
    } catch {
      throw new Error("Stored AI provider credential could not be decrypted");
    }
  }

  private createAssociatedData(idUser: string, providerId: string): Buffer {
    return Buffer.from(`${idUser}\0${providerId}`, "utf8");
  }
}
