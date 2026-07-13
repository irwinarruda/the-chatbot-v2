import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/google/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService = ServerBootstrap.getApplication().services.auth;
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        await authService.handleGoogleRedirect(state, code);
        return Http.redirect(new URL("/google/thank-you", request.url).href);
      },
    },
  },
});
