import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/server/services/AuthService";
import { Http } from "~/server/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/login")({
  server: {
    handlers: {
      async GET() {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const result = await authService.handleWebGoogleLogin();
        return Http.redirect(result.url);
      },
    },
  },
});
