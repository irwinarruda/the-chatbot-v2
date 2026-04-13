import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/server/services/AuthService";
import { Http } from "~/server/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/login")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const url = new URL(request.url);
        const phoneNumber = url.searchParams.get("phone_number") ?? "";
        const result = await authService.handleWebGoogleLogin(phoneNumber);
        if (result.type === "notRegistered") {
          return Http.redirect(
            new URL("/chat/not-registered", request.url).href,
          );
        }
        return Http.redirect(result.url);
      },
    },
  },
});
