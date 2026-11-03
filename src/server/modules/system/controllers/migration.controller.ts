import { createFileRoute } from "@tanstack/react-router";
import { getServer } from "~/server/production";
import { Http } from "~/server/shared/http/utils/http";

export const Route = createFileRoute("/api/v1/migration")({
  server: {
    handlers: {
      async GET() {
        const migrationService = getServer().services.migration;
        const migrations = await migrationService.listPendingMigrations();
        return Http.json(migrations);
      },
      async POST({ request }) {
        const migrationService = getServer().services.migration;
        const password = request.headers.get("x-migration-password") ?? "";
        await migrationService.runPendingMigrations(password);
        return Http.json(undefined);
      },
    },
  },
});
