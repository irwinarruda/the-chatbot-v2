import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { Http } from "~/shared/http/utils/Http";
import {
  deleteWebAuthCookie,
  setWebAuthCookie,
} from "~/shared/http/utils/WebAuthCookie";
import {
  deleteWebLoginCookies,
  getWebLoginRedirect,
  hasValidWebLoginState,
} from "~/shared/http/utils/WebLoginCookie";

export const Route = createFileRoute("/api/v1/web/auth/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService = ServerBootstrap.getApplication().services.auth;
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";
        const state = url.searchParams.get("state") ?? "";
        const redirectTo = getWebLoginRedirect(request);
        const headers = new Headers();
        if (!hasValidWebLoginState(request, state)) {
          deleteWebAuthCookie(headers, request);
          deleteWebLoginCookies(headers, request);
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("redirect", redirectTo);
          return Http.redirect(loginUrl.href, { headers });
        }
        let token = "";
        try {
          token = await authService.handleWebGoogleRedirect(code);
        } catch {
          deleteWebAuthCookie(headers, request);
          deleteWebLoginCookies(headers, request);
          const notRegisteredUrl = new URL("/not-registered", request.url);
          notRegisteredUrl.searchParams.set("redirect", redirectTo);
          return Http.redirect(notRegisteredUrl.href, { headers });
        }
        setWebAuthCookie(headers, request, token);
        deleteWebLoginCookies(headers, request);
        return Http.redirect(new URL(redirectTo, request.url).href, {
          headers,
        });
      },
    },
  },
});
