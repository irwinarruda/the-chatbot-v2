import { createFileRoute } from "@tanstack/react-router";
import { getService } from "~/infra/server-bootstrap";
import type { MigrationService } from "~/services/MigrationService";

export const Route = createFileRoute("/api/v1/migration")({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async () => {
          const migrationService =
            getService<MigrationService>("MigrationService");
          const migrations = await migrationService.listPendingMigrations();
          return new Response(JSON.stringify(migrations), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
        POST: async ({ request }) => {
          const migrationService =
            getService<MigrationService>("MigrationService");
          const password = request.headers.get("x-migration-password") ?? "";
          await migrationService.runPendingMigrations(password);
          return new Response(null, { status: 204 });
        },
      }),
  },
});
