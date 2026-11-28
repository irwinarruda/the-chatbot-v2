import { createFileRoute } from "@tanstack/react-router";
import { OAuthAuthorizationRequestDTO } from "~/contracts/http/mcp/oauth";
import {
  toOAuthConsentPage,
  toOAuthErrorPage,
} from "~/contracts/http/mcp/oauth-page-mapper";
import { OAuthException } from "~/server/modules/mcp/services/mcp-oauth.service";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { getWebAuthToken } from "~/server/shared/http/utils/web-auth-cookie";

export const Route = createFileRoute("/api/v1/oauth/authorize")({
  server: {
    handlers: {
      async GET({ request }) {
        try {
          const url = new URL(request.url);
          const parsed = OAuthAuthorizationRequestDTO.safeParse(
            Object.fromEntries(url.searchParams),
          );
          if (!parsed.success) {
            return Http.html(
              toOAuthErrorPage(
                "O pedido de conexão é inválido. Remova o conector e adicione de novo.",
              ),
              { status: 400 },
            );
          }
          const prompt =
            await getServer().services.mcpOAuth.prepareAuthorization(
              parsed.data,
              getWebAuthToken(request),
            );
          if (!prompt.user) {
            const login = new URLSearchParams({
              redirect: `${url.pathname}${url.search}`,
            });
            return Http.redirect(`/api/v1/web/auth/login?${login}`);
          }
          return Http.html(
            toOAuthConsentPage({
              clientName: prompt.client.name ?? "Um aplicativo",
              redirectHost: new URL(parsed.data.redirect_uri).host,
              userEmail: prompt.user.email ?? "",
              request: parsed.data,
            }),
          );
        } catch (error) {
          if (error instanceof OAuthException) {
            return Http.html(toOAuthErrorPage(error.message), { status: 400 });
          }
          throw error;
        }
      },
    },
  },
});
