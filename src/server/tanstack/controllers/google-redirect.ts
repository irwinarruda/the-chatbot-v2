import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/server/services/AuthService";
import { Http } from "~/server/utils/Http";

export const Route = createFileRoute("/api/v1/google/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        await authService.handleGoogleRedirect(state, code);
        return Http.redirect(
          new URL("/google/thank-you", request.url).href,
        );
      },
    },
  },
});
