import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import type { AuthService } from "~/services/AuthService";

export const Route = createFileRoute("/api/v1/google/redirect")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async ({ request }) => {
          const authService = getService<AuthService>("AuthService");
          const url = new URL(request.url);
          const state = url.searchParams.get("state") ?? "";
          const code = url.searchParams.get("code") ?? "";
          await authService.handleGoogleRedirect(state, code);
          return new Response(null, {
            status: 302,
            headers: {
              Location: new URL("/google/thank-you", request.url).href,
            },
          });
        },
      }),
  },
});
