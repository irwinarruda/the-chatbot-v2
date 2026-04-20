import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "~/infra/cookie";
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
        const code = url.searchParams.get("code") ?? "";
        let token = "";
        try {
          token = await authService.handleWebGoogleRedirect(code);
        } catch {
          const headers = new Headers();
          Cookie.delete(headers, AUTH_COOKIE);
          return Http.redirect(
            new URL("/chat/not-registered", request.url).href,
            { headers },
          );
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
