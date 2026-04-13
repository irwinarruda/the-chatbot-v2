import { getService } from "@infra/server-bootstrap";
import { createFileRoute } from "@tanstack/react-router";
import type { IGoogleAuthGateway } from "~/resources/IGoogleAuthGateway";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/web/auth/login")({
  server: {
    handlers: {
      async GET() {
        const googleAuthGateway =
          getService<IGoogleAuthGateway>("IGoogleAuthGateway");
        const url = googleAuthGateway.createWebAuthorizationCodeUrl();
        return Http.json(null, {
          status: 302,
          headers: { Location: url },
        });
      },
    },
  },
});
