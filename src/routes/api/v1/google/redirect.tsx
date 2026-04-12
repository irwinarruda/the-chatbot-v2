import { getService } from "@infra/server-bootstrap";
import { createFileRoute } from "@tanstack/react-router";
import type { AuthService } from "~/services/AuthService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/google/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService = getService<AuthService>("AuthService");
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        await authService.handleGoogleRedirect(state, code);
        return Http.json(null, {
          status: 302,
          headers: {
            Location: new URL("/google/thank-you", request.url).href,
          },
        });
      },
    },
  },
});
