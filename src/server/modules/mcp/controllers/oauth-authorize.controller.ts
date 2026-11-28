import { createFileRoute } from "@tanstack/react-router";
import { toOAuthConsentPagePath } from "~/contracts/http/mcp/oauth-mapper";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/oauth/authorize")({
  server: {
    handlers: {
      GET({ request }) {
        const query = new URL(request.url).search.slice(1);
        return Http.redirect(toOAuthConsentPagePath(query), {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
