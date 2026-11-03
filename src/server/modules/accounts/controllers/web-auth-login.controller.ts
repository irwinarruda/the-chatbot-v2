import { createFileRoute } from "@tanstack/react-router";
import { normalizeWebLoginRedirect } from "~/contracts/http/identity/web-login-navigation";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import {
  createWebLoginState,
  setWebLoginCookies,
} from "~/server/shared/http/utils/web-login-cookie";

export const Route = createFileRoute("/api/v1/web/auth/login")({
  server: {
    handlers: {
      async GET({ request }) {
        const requestUrl = new URL(request.url);
        const redirectTo = normalizeWebLoginRedirect(
          requestUrl.searchParams.get("redirect"),
        );
        const state = createWebLoginState();
        const authService = getServer().services.auth;
        const result = await authService.handleWebGoogleLogin(state);
        const headers = new Headers();
        setWebLoginCookies(headers, request, state, redirectTo);
        return Http.redirect(result.url, { headers });
      },
    },
  },
});
