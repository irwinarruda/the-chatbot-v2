import { createFileRoute } from "@tanstack/react-router";
import { Http } from "~/server/shared/http/utils/http";
import { deleteWebAuthCookie } from "~/server/shared/http/utils/web-auth-cookie";

export const Route = createFileRoute("/api/v1/web/auth/logout")({
  server: {
    handlers: {
      async POST({ request }) {
        const headers = new Headers();
        deleteWebAuthCookie(headers, request);
        return Http.json(undefined, { status: 200, headers });
      },
    },
  },
});
