import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import type { StatusService } from "~/services/StatusService";
import { Printable } from "~/utils/Printable";

export const Route = createFileRoute("/api/v1/status")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async () => {
          const statusService = getService<StatusService>("StatusService");
          const status = await statusService.getStatus();
          return new Response(JSON.stringify(Printable.make(status)), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      }),
  },
});
