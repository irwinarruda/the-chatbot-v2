import { createFileRoute } from "@tanstack/react-router";
import { toStatusResponse } from "~/contracts/http/system/status-mapper";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/status")({
  server: {
    handlers: {
      async GET() {
        const statusService = getServer().services.status;
        const status = await statusService.getStatus();
        return Http.json(toStatusResponse(status), {
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json",
          },
        });
      },
    },
  },
});
