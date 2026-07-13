import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import { Http } from "~/shared/http/utils/Http";

export const Route = createFileRoute("/api/v1/migration")({
  server: {
    handlers: {
      async GET() {
        const migrationService =
          ServerBootstrap.getApplication().services.migration;
        const migrations = await migrationService.listPendingMigrations();
        return Http.json(migrations);
      },
      async POST({ request }) {
        const migrationService =
          ServerBootstrap.getApplication().services.migration;
        const password = request.headers.get("x-migration-password") ?? "";
        await migrationService.runPendingMigrations(password);
        return Http.json(undefined);
      },
    },
  },
});
