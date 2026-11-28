import { z } from "zod";

export const OAuthConsentSearchDTO = z.object({
  request: z.string().max(8000).catch(""),
});

export type OAuthConsentSearchDTO = z.infer<typeof OAuthConsentSearchDTO>;

export function normalizeOAuthConsentSearch(
  search: Record<string, unknown>,
): OAuthConsentSearchDTO {
  return OAuthConsentSearchDTO.parse({ request: search.request });
}
