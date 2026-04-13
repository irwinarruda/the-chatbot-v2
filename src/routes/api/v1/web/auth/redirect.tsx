import { loadConfig } from "@infra/config";
import { signJwt } from "@infra/jwt";
import { getService } from "@infra/server-bootstrap";
import { setAuthCookie } from "@infra/web";
import { createFileRoute } from "@tanstack/react-router";
import type { AuthService } from "~/services/AuthService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const config = loadConfig();
        const authService = getService<AuthService>("AuthService");
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";
        const user = await authService.handleWebGoogleRedirect(code);
        const token = await signJwt(
          {
            userId: user.id,
            email: user.email,
            phoneNumber: user.phoneNumber,
          },
          config.jwt.secret,
          config.jwt.expiresIn,
        );
        const headers = new Headers();
        const isSecure = url.protocol === "https:";
        setAuthCookie(headers, token, isSecure);
        headers.set("Location", new URL("/chat", request.url).href);
        return Http.json(null, {
          status: 302,
          headers,
        });
      },
    },
  },
});
