import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import type { AuthService } from "~/services/AuthService";

export const Route = createFileRoute("/api/v1/google/login")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async ({ request }) => {
          const authService = getService<AuthService>("AuthService");
          const url = new URL(request.url);
          const phoneNumber = url.searchParams.get("phone_number") ?? "";
          const result = await authService.handleGoogleLogin(phoneNumber);
          if (result.type === "redirect") {
            return new Response(null, {
              status: 302,
              headers: { Location: result.url },
            });
          }
          return new Response(null, {
            status: 302,
            headers: {
              Location: new URL("/google/already-signed-in", request.url).href,
            },
          });
        },
      }),
  },
});
