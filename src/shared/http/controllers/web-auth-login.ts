import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { normalizeWebLoginRedirect } from "~/modules/identity/utils/WebLoginNavigation";
import { Http } from "~/shared/http/utils/Http";
import {
  createWebLoginState,
  setWebLoginCookies,
} from "~/shared/http/utils/WebLoginCookie";

export const Route = createFileRoute("/api/v1/web/auth/login")({
  server: {
    handlers: {
      async GET({ request }) {
        const requestUrl = new URL(request.url);
        const redirectTo = normalizeWebLoginRedirect(
          requestUrl.searchParams.get("redirect"),
        );
        const state = createWebLoginState();
        const authService = ServerBootstrap.getApplication().services.auth;
        const result = await authService.handleWebGoogleLogin(state);
        const headers = new Headers();
        setWebLoginCookies(headers, request, state, redirectTo);
        return Http.redirect(result.url, { headers });
      },
    },
  },
});
