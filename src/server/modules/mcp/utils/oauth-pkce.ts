import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createOAuthSecret(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function hashOAuthSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function isPkceVerifierValid(
  verifier: string,
  challenge: string,
): boolean {
  const computed = Buffer.from(
    createHash("sha256").update(verifier, "ascii").digest("base64url"),
  );
  const expected = Buffer.from(challenge);
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
}
