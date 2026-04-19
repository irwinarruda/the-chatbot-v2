import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "~/infra/cookie";
import { NotFoundException } from "~/infra/exceptions";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/server/services/AuthService";
import { Http } from "~/server/utils/Http";

const AUTH_COOKIE = "web_auth_token";

export const Route = createFileRoute("/api/v1/web/auth/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        let token: string;
        try {
          token = await authService.handleWebGoogleRedirect(state, code);
        } catch (error) {
          if (error instanceof NotFoundException) {
            return Http.redirect(
              new URL("/chat/not-registered", request.url).href,
            );
          }
          throw error;
        }
        const headers = new Headers();
        const isSecure = url.protocol === "https:";
        Cookie.set(headers, AUTH_COOKIE, token, {
          maxAge: 7 * 24 * 60 * 60,
          secure: isSecure,
          sameSite: isSecure ? "None" : "Lax",
        });
        return Http.redirect(new URL("/chat", request.url).href, { headers });
      },
    },
  },
});
