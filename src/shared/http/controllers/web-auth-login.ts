import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/login")({
  server: {
    handlers: {
      async GET() {
        const authService = ServerBootstrap.getApplication().services.auth;
        const result = await authService.handleWebGoogleLogin();
        return Http.redirect(result.url);
      },
    },
  },
});
