import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/services/AuthService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/login")({
  server: {
    handlers: {
      async GET() {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const url = authService.getWebLoginUrl();
        return Http.redirect(url);
      },
    },
  },
});
