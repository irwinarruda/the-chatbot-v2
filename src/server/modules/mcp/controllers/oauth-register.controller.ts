import { createFileRoute } from "@tanstack/react-router";
import {
  OAuthClientRegistrationRequestDTO,
  OAuthErrorCode,
} from "~/contracts/http/mcp/oauth";
import {
  toOAuthClientRegistrationResponse,
  toOAuthErrorResponse,
} from "~/contracts/http/mcp/oauth-mapper";
import { getServer } from "~/server/production";
import { corsPreflight, withCors } from "~/server/shared/http/utils/cors";
import { Http } from "~/server/shared/http/utils/http";
import { parseJsonRequest } from "~/server/shared/http/utils/json-request";

export const Route = createFileRoute("/api/v1/oauth/register")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      async POST({ request }) {
        const parsed = OAuthClientRegistrationRequestDTO.safeParse(
          await parseJsonRequest(request, { maxBytes: 16_384 }),
        );
        if (!parsed.success) {
          const isRedirectIssue = parsed.error.issues.some(
            (issue) => issue.path[0] === "redirect_uris",
          );
          return withCors(
            Http.json(
              toOAuthErrorResponse(
                isRedirectIssue
                  ? OAuthErrorCode.InvalidRedirectUri
                  : OAuthErrorCode.InvalidClientMetadata,
                parsed.error.issues.map((issue) => issue.message).join("; "),
              ),
              { status: 400 },
            ),
          );
        }
        const client = await getServer().services.mcpOAuth.registerClient(
          parsed.data,
        );
        return withCors(
          Http.json(toOAuthClientRegistrationResponse(client), { status: 201 }),
        );
      },
    },
  },
});
