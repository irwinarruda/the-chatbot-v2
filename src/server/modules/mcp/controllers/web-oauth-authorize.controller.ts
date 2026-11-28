import { createFileRoute } from "@tanstack/react-router";
import { OAuthAuthorizationDecisionDTO } from "~/contracts/http/mcp/oauth";
import {
  toOAuthErrorPage,
  toOAuthRedirectPage,
} from "~/contracts/http/mcp/oauth-page-mapper";
import { OAuthException } from "~/server/modules/mcp/services/mcp-oauth.service";
import { getServer } from "~/server/production";
import { parseFormRequest } from "~/server/shared/http/utils/form-request";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/web/oauth/authorize")({
  server: {
    handlers: {
      async POST({ request, context }) {
        try {
          const mcpOAuth = getServer().services.mcpOAuth;
          const { decision, ...authorization } =
            OAuthAuthorizationDecisionDTO.parse(
              await parseFormRequest(request),
            );
          const redirectUrl =
            decision === "approve"
              ? await mcpOAuth.approveAuthorization(
                  context.webAuth.userId,
                  authorization,
                )
              : await mcpOAuth.denyAuthorization(authorization);
          return Http.html(toOAuthRedirectPage(redirectUrl));
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
