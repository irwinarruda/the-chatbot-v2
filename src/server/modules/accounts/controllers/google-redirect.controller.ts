import { createFileRoute } from "@tanstack/react-router";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/google/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const accounts = getServer().services.accounts;
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        await accounts.completeGoogleSignIn(state, code);
        return Http.redirect(new URL("/google/thank-you", request.url).href);
      },
    },
  },
});
