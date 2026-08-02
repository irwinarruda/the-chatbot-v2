import { z } from "zod";

const AiProviderApiKeyCredentialDTO = z.object({
  type: z.literal("api_key"),
  key: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const AiProviderOAuthCredentialDTO = z
  .object({
    type: z.literal("oauth"),
    access: z.string().min(1),
    refresh: z.string().min(1),
    expires: z.number().finite(),
  })
  .passthrough();

export const AiProviderCredentialDTO = z.discriminatedUnion("type", [
  AiProviderApiKeyCredentialDTO,
  AiProviderOAuthCredentialDTO,
]);

export type AiProviderCredentialDTO = z.infer<typeof AiProviderCredentialDTO>;

export const AiProviderCredentialEnvelopeDTO = z.object({
  nonce: z.base64(),
  ciphertext: z.base64(),
  authenticationTag: z.base64(),
});

export type AiProviderCredentialEnvelopeDTO = z.infer<
  typeof AiProviderCredentialEnvelopeDTO
>;
