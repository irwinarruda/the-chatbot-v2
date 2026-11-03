import { createFileRoute } from "@tanstack/react-router";
import { StartAppGoogleLoginRequestDTO } from "~/contracts/http/identity/google-auth";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/g/$challenge")({
  server: {
    handlers: {
      async GET({ params, request }) {
        const authService = getServer().services.auth;
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
