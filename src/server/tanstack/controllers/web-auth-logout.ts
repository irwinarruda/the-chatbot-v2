import { createFileRoute } from "@tanstack/react-router";
import { Cookie } from "~/infra/cookie";
import { Http } from "~/server/utils/Http";

const AUTH_COOKIE = "web_auth_token";

export const Route = createFileRoute("/api/v1/web/auth/logout")({
  server: {
    handlers: {
      async POST() {
        const headers = new Headers();
        Cookie.delete(headers, AUTH_COOKIE);
        return Http.json(undefined, { status: 200, headers });
      },
    },
  },
});
