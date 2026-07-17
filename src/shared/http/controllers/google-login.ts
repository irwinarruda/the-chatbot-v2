import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { StartAppGoogleLoginRequestDTO } from "~/modules/identity/entities/dtos/GoogleAuthDTO";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/g/$challenge")({
  server: {
    handlers: {
      async GET({ params, request }) {
        const authService = ServerBootstrap.getApplication().services.auth;
        const { challenge } = StartAppGoogleLoginRequestDTO.parse({
          challenge: params.challenge,
        });
        const result = await authService.handleGoogleLogin(challenge);
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
