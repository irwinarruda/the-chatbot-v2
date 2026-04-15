import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "~/infra/cookie";
import { UnauthorizedException } from "~/infra/exceptions";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { AuthService } from "~/services/AuthService";
import { Http } from "~/utils/Http";

const AUTH_COOKIE = "web_auth_token";

export const Route = createFileRoute("/api/v1/web/auth/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService =
          ServerBootstrap.getService<AuthService>("AuthService");
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";
        let token: string;
        try {
          ({ token } = await authService.handleWebLogin(code));
        } catch (error) {
          if (
            error instanceof UnauthorizedException &&
            error.message === "User not registered"
          ) {
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
        const postLoginRedirect = authService.getWebPostLoginRedirect();
        const redirectUrl =
          postLoginRedirect || new URL("/chat", request.url).href;
        return Http.redirect(redirectUrl, { headers });
      },
    },
  },
});
