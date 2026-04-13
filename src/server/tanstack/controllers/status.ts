import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { StatusService } from "~/server/services/StatusService";
import { Http } from "~/server/utils/Http";

export const Route = createFileRoute("/api/v1/status")({
  server: {
    handlers: {
      async GET() {
        const statusService =
          ServerBootstrap.getService<StatusService>("StatusService");
        const status = await statusService.getStatus();
        return Http.json(status);
      },
    },
  },
});
