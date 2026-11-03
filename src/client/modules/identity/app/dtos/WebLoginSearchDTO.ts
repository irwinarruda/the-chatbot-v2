import { z } from "zod";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";

export const WebLoginSearchDTO = z.object({
  redirect: z.string(),
});

export type WebLoginSearchDTO = z.infer<typeof WebLoginSearchDTO>;

export function normalizeWebLoginSearch(
  search: Record<string, unknown>,
): WebLoginSearchDTO {
  return WebLoginSearchDTO.parse({
    redirect: normalizeWebLoginRedirect(search.redirect),
  });
}
