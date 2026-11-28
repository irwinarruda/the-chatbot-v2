import { createFileRoute } from "@tanstack/react-router";
import {
  OAuthErrorCode,
  OAuthTokenRequestDTO,
} from "~/contracts/http/mcp/oauth";
import {
  toOAuthErrorResponse,
  toOAuthTokenResponse,
} from "~/contracts/http/mcp/oauth-mapper";
import { OAuthException } from "~/server/modules/mcp/services/mcp-oauth.service";
import { getServer } from "~/server/production";
import { corsPreflight, withCors } from "~/server/shared/http/utils/cors";
import { parseFormRequest } from "~/server/shared/http/utils/form-request";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/oauth/token")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      async POST({ request }) {
        try {
          const form = await parseFormRequest(request);
          const parsed = OAuthTokenRequestDTO.safeParse(form);
          if (!parsed.success) {
            const isKnownGrant =
              form.grant_type === "authorization_code" ||
              form.grant_type === "refresh_token";
            return oauthError(
              isKnownGrant
                ? OAuthErrorCode.InvalidRequest
                : OAuthErrorCode.UnsupportedGrantType,
              "The token request is invalid.",
            );
          }
          const tokens = await getServer().services.mcpOAuth.exchangeToken(
            parsed.data,
          );
          const response = Http.json(toOAuthTokenResponse(tokens));
          response.headers.set("Cache-Control", "no-store");
          return withCors(response);
        } catch (error) {
          if (error instanceof OAuthException) {
            return oauthError(error.error, error.message);
          }
          throw error;
        }
      },
    },
  },
});

function oauthError(error: OAuthErrorCode, description: string): Response {
  const response = Http.json(toOAuthErrorResponse(error, description), {
    status: 400,
  });
  response.headers.set("Cache-Control", "no-store");
  return withCors(response);
}
