import { createCipheriv, createDecipheriv } from "crypto";
import type { EncryptionConfig } from "./config";

export class Encryption {
  private key: Buffer;
  private iv: Buffer;

  constructor(config: EncryptionConfig) {
    this.key = Buffer.from(config.text32Bytes, "base64");
    this.iv = Buffer.from(config.text16Bytes, "base64");
  }

  encrypt(plainText: string): string {
    const cipher = createCipheriv("aes-256-cbc", this.key, this.iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    return encrypted.toString("base64");
  }

  decrypt(cipherText: string): string {
    const decipher = createDecipheriv("aes-256-cbc", this.key, this.iv);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherText, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}
