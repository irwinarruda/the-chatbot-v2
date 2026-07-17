import { createFileRoute } from "@tanstack/react-router";
import { Http } from "~/shared/http/utils/Http";
import { deleteWebAuthCookie } from "~/shared/http/utils/WebAuthCookie";

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
