import { clearAuthCookie } from "@infra/web";
import { createFileRoute } from "@tanstack/react-router";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/logout")({
  server: {
    handlers: {
      async POST() {
        const headers = new Headers();
        clearAuthCookie(headers);
        return Http.json(null, { status: 200, headers });
      },
    },
  },
});
