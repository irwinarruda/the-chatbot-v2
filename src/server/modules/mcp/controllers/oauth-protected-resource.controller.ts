import { createFileRoute } from "@tanstack/react-router";
import { toProtectedResourceMetadataResponse } from "~/contracts/http/mcp/oauth-mapper";
import { corsPreflight, withCors } from "~/server/shared/http/utils/cors";
import { Http } from "~/server/shared/http/utils/http";
import { getPublicOrigin } from "~/server/shared/http/utils/public-origin";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      GET: ({ request }) =>
        withCors(
          Http.json(
            toProtectedResourceMetadataResponse(getPublicOrigin(request)),
          ),
        ),
    },
  },
});
