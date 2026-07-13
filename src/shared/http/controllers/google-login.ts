import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/google/login")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService = ServerBootstrap.getApplication().services.auth;
        const url = new URL(request.url);
        const id = url.searchParams.get("id") ?? "";
        const result = await authService.handleGoogleLogin(id);
        if (result.type === "redirect") {
          return Http.redirect(result.url);
        }
        return Http.redirect(
          new URL("/google/already-signed-in", request.url).href,
        );
      },
    },
  },
});
