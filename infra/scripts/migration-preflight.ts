import { devNull } from "os";
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

export function prepareMigrationCommand(
  mode: string,
  env: NodeJS.ProcessEnv,
  args: string[],
  migrationsDir: string,
) {
  assertMigrationPreflight(mode, env, args);
  if (args.some((argument) => /^--(?:no-)?env-?path(?:=|$)/i.test(argument))) {
    throw new Error("Migration environment is already loaded by the wrapper");
  }
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    DATABASE_URL: env.DATABASE_CONNECTION_STRING,
  };
  for (const key of Object.keys(childEnv)) {
    if (key.startsWith("DOTENV_")) delete childEnv[key];
  }

  // The CLI loads dotenv again; an empty file prevents changing the checked target.
  return {
    args: ["--migrations-dir", migrationsDir, ...args, "--envPath", devNull],
    env: childEnv,
  };
}
