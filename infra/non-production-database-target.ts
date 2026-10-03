import type { DatabaseConfig } from "~/shared/config/Config";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const localDatabaseNames = new Set(["local_db", "test_db"]);
const allowedUrlParameters = new Set([
  "sslmode",
  "sslrootcert",
  "channel_binding",
  "application_name",
  "connect_timeout",
]);

export interface NonProductionDatabaseTarget {
  hostname: string;
  databaseName: string;
}

export function assertNonProductionDatabaseTarget(
  config: DatabaseConfig,
  mode: string | undefined,
  allowedHost: string | undefined,
): NonProductionDatabaseTarget {
  if (mode !== "test" && mode !== "development" && mode !== "preview") {
    throw new Error(
      "Database reset requires test, development, or preview mode",
    );
  }
  let databaseUrl: URL;
  let databaseName: string;
  try {
    databaseUrl = new URL(config.connectionString);
    databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  } catch {
    throw new Error(
      "Database reset requires a valid PostgreSQL connection URL",
    );
  }
  if (
    databaseUrl.protocol !== "postgres:" &&
    databaseUrl.protocol !== "postgresql:"
  ) {
    throw new Error("Database reset requires a PostgreSQL connection URL");
  }
  const authority = config.connectionString.split("://")[1]?.split(/[/?#]/)[0];
  // postgres.js parses multihost URLs before WHATWG URL parses user information.
  if (
    !authority ||
    authority.includes(",") ||
    authority.split("@").length > 2
  ) {
    throw new Error("Database reset requires an unambiguous single-host URL");
  }
  if (!databaseName || databaseName !== config.name) {
    throw new Error("Database reset target does not match DATABASE_NAME");
  }
  if (
    !databaseUrl.hostname ||
    databaseUrl.hash ||
    config.connectionString.includes("\0") ||
    /%00/i.test(config.connectionString) ||
    [...databaseUrl.searchParams.keys()].some(
      (key) => !allowedUrlParameters.has(key),
    )
  ) {
    throw new Error(
      "Database reset URL contains unsupported connection options",
    );
  }
  if (mode === "preview") {
    if (allowedHost !== undefined && allowedHost !== databaseUrl.hostname) {
      throw new Error(
        "Preview database host does not match TEST_DATABASE_ALLOWED_HOST",
      );
    }
    if (
      databaseName !== "preview" &&
      (databaseName !== "neondb" || !allowedHost)
    ) {
      throw new Error(
        "Preview reset requires preview, or neondb with TEST_DATABASE_ALLOWED_HOST",
      );
    }
  } else if (
    !localHosts.has(databaseUrl.hostname) ||
    !localDatabaseNames.has(databaseName)
  ) {
    throw new Error(
      "Local database reset requires loopback and local_db or test_db",
    );
  }

  return { hostname: databaseUrl.hostname, databaseName };
}
