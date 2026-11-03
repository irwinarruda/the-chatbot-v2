import { createFileRoute } from "@tanstack/react-router";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";
import {
  deleteWebAuthCookie,
  setWebAuthCookie,
} from "~/server/shared/http/utils/web-auth-cookie";
import {
  deleteWebLoginCookies,
  getWebLoginRedirect,
  hasValidWebLoginState,
} from "~/server/shared/http/utils/web-login-cookie";

export const Route = createFileRoute("/api/v1/web/auth/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const accounts = getServer().services.accounts;
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
          token = await accounts.completeWebGoogleSignIn(code);
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
