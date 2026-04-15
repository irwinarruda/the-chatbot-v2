import { createFileRoute } from "@tanstack/react-router";
import { ServerBootstrap } from "~/infra/server-bootstrap";
import type { MigrationService } from "~/services/MigrationService";
import { Http } from "~/utils/Http";

export const Route = createFileRoute("/api/v1/migration")({
  server: {
    handlers: {
      async GET() {
        const migrationService =
          ServerBootstrap.getService<MigrationService>("MigrationService");
        const migrations = await migrationService.listPendingMigrations();
        return Http.json(migrations);
      },
      async POST({ request }) {
        const migrationService =
          ServerBootstrap.getService<MigrationService>("MigrationService");
        const password = request.headers.get("x-migration-password") ?? "";
        await migrationService.runPendingMigrations(password);
        return Http.json(null);
      },
    },
  },
});
