import { z } from "zod";

export const GoogleCredentialSecretDTO = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type GoogleCredentialSecretDTO = z.infer<
  typeof GoogleCredentialSecretDTO
>;

export const GoogleCredentialEnvelopeDTO = z.object({
  nonce: z.base64(),
  ciphertext: z.base64(),
  authenticationTag: z.base64(),
});

export type GoogleCredentialEnvelopeDTO = z.infer<
  typeof GoogleCredentialEnvelopeDTO
>;
