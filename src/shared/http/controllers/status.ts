import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/status")({
  server: {
    handlers: {
      async GET() {
        const statusService = ServerBootstrap.getApplication().services.status;
        const status = await statusService.getStatus();
        return Http.json(status);
      },
    },
  },
});
