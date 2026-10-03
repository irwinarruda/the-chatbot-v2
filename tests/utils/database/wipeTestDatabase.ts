import { Database } from "~/infra/database";
import type { DatabaseConfig } from "~/shared/config/Config";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const localDatabaseNames = new Set(["local_db", "test_db"]);

export function createTestDatabase(
  config: DatabaseConfig,
  mode: string | undefined,
): Database {
  assertTestDatabaseTarget(config, mode);
  try {
    return new Database(config.connectionString, { onnotice: () => {} });
  } catch {
    throw new Error("Cannot initialize the allowed test database connection");
  }
}

export async function wipeTestDatabase(
  database: DatabaseGateway,
  config: DatabaseConfig,
  mode: string | undefined,
): Promise<void> {
  const databaseName = assertTestDatabaseTarget(config, mode);
  // Check and reset on the same connection; pooled connections must not differ.
  await database.transaction(async (sql) => {
    const rows = await sql<{ database_name: string }[]>`
      SELECT current_database() AS database_name
    `;
    if (rows.length !== 1 || rows[0].database_name !== databaseName) {
      throw new Error(
        "Connected database does not match the allowed reset target",
      );
    }
    await sql`DROP SCHEMA public CASCADE`;
    await sql`CREATE SCHEMA public`;
  });
}

function assertTestDatabaseTarget(
  config: DatabaseConfig,
  mode: string | undefined,
): string {
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
  if (mode === "preview") {
    if (databaseName !== "preview") {
      throw new Error("Preview database reset requires the preview database");
    }
  } else if (
    !localHosts.has(databaseUrl.hostname) ||
    !localDatabaseNames.has(databaseName)
  ) {
    throw new Error(
      "Local database reset requires loopback and local_db or test_db",
    );
  }

  return databaseName;
}
