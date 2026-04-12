import { getService } from "@infra/server-bootstrap";
import { createFileRoute } from "@tanstack/react-router";
import type { AuthService } from "~/services/AuthService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/google/login")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService = getService<AuthService>("AuthService");
        const url = new URL(request.url);
        const phoneNumber = url.searchParams.get("phone_number") ?? "";
        const result = await authService.handleGoogleLogin(phoneNumber);
        if (result.type === "redirect") {
          return Http.json(null, {
            status: 302,
            headers: { Location: result.url },
          });
        }
        return Http.json(null, {
          status: 302,
          headers: {
            Location: new URL("/google/already-signed-in", request.url).href,
          },
        });
      },
    },
  },
});
