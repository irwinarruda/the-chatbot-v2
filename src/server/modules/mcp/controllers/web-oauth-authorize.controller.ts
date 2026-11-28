import { createFileRoute } from "@tanstack/react-router";
import {
  OAuthAuthorizationDecisionDTO,
  OAuthAuthorizationRequestDTO,
  OAuthErrorCode,
} from "~/contracts/http/mcp/oauth";
import {
  toOAuthConsentDecisionResponse,
  toOAuthConsentPromptResponse,
} from "~/contracts/http/mcp/oauth-mapper";
import { OAuthException } from "~/server/modules/mcp/services/mcp-oauth.service";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";
import { getWebAuthToken } from "~/server/shared/http/utils/web-auth-cookie";

const INVALID_REQUEST_MESSAGE = "The connection request is invalid.";

export const Route = createFileRoute("/api/v1/web/oauth/authorize")({
  server: {
    handlers: {
      async GET({ request, context }) {
        const parsed = OAuthAuthorizationRequestDTO.safeParse(
          Object.fromEntries(new URL(request.url).searchParams),
        );
        if (!parsed.success) {
          throw new OAuthException(
            OAuthErrorCode.InvalidRequest,
            INVALID_REQUEST_MESSAGE,
          );
        }
        const prompt = await getServer().services.mcpOAuth.prepareAuthorization(
          parsed.data,
          getWebAuthToken(request),
        );
        return Http.json(
          toOAuthConsentPromptResponse({
            clientName: prompt.client.name,
            redirectHost: new URL(parsed.data.redirect_uri).host,
            userEmail: prompt.user?.email ?? context.webAuth.email,
          }),
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      async POST({ request, context }) {
        const parsed = OAuthAuthorizationDecisionDTO.safeParse(
          await parseJsonRequest(request, { maxBytes: 16_384 }),
        );
        if (!parsed.success) {
          throw new OAuthException(
            OAuthErrorCode.InvalidRequest,
            INVALID_REQUEST_MESSAGE,
          );
        }
        const mcpOAuth = getServer().services.mcpOAuth;
        const { decision, ...authorization } = parsed.data;
        const redirectUrl =
          decision === "approve"
            ? await mcpOAuth.approveAuthorization(
                context.webAuth.userId,
                authorization,
              )
            : await mcpOAuth.denyAuthorization(authorization);
        return Http.json(toOAuthConsentDecisionResponse(redirectUrl), {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
