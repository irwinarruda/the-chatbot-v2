import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import type { StatusService } from "~/services/StatusService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/status")({
  server: {
    handlers: {
      async GET() {
        const statusService = getService<StatusService>("StatusService");
        const status = await statusService.getStatus();
        return Http.json(status.toJSON());
      },
    },
  },
});
