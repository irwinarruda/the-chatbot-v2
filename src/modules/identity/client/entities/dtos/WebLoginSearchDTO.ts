import { z } from "zod";
import { normalizeWebLoginRedirect } from "~/modules/identity/utils/WebLoginNavigation";

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
