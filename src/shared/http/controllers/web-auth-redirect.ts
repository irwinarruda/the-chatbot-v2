import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { Http } from "~/shared/http/utils/Http";
import {
  deleteWebAuthCookie,
  setWebAuthCookie,
} from "~/shared/http/utils/WebAuthCookie";

export const Route = createFileRoute("/api/v1/web/auth/redirect")({
  server: {
    handlers: {
      async GET({ request }) {
        const authService = ServerBootstrap.getApplication().services.auth;
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";
        let token = "";
        try {
          token = await authService.handleWebGoogleRedirect(code);
        } catch {
          const headers = new Headers();
          deleteWebAuthCookie(headers, request);
          return Http.redirect(
            new URL("/chat/not-registered", request.url).href,
            { headers },
          );
        }
        const headers = new Headers();
        setWebAuthCookie(headers, request, token);
        return Http.redirect(new URL("/chat", request.url).href, { headers });
      },
    },
  },
});
