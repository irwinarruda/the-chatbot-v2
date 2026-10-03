import { assertNonProductionDatabaseTarget } from "~/infra/non-production-database-target";

const allowedMigrationFlags = new Set([
  "--schema",
  "--create-schema",
  "--migrations-table",
  "--migrations-schema",
  "--create-migrations-schema",
  "--check-order",
  "--no-check-order",
  "--verbose",
  "--no-verbose",
  "--ignore-pattern",
  "--decamelize",
  "--dry-run",
  "--fake",
  "--single-transaction",
  "--no-single-transaction",
  "--lock",
  "--no-lock",
  "--lock-value",
  "--timestamp",
  "--advisory-lock-mode",
  "--help",
  "--version",
]);

export function assertMigrationPreflight(
  mode: string,
  env: NodeJS.ProcessEnv,
  args: string[],
): void {
  if (mode === "production") return;

  assertNonProductionDatabaseTarget(
    {
      name: env.DATABASE_NAME ?? "",
      connectionString: env.DATABASE_CONNECTION_STRING ?? "",
    },
    mode,
    env.TEST_DATABASE_ALLOWED_HOST,
  );
  if (env.PGOPTIONS) {
    throw new Error("Non-production migrations do not accept PGOPTIONS");
  }
  for (const argument of args) {
    if (!argument.startsWith("-") || /^-\d+$/.test(argument)) continue;
    const flag = argument.split("=", 1)[0];
    if (!allowedMigrationFlags.has(flag)) {
      throw new Error(
        "Non-production migrations do not accept connection/configuration overrides or unknown flags",
      );
    }
  }
}
