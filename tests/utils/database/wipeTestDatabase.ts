import { Database } from "~/infra/database";
import type { DatabaseConfig } from "~/shared/config/Config";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/shared/gateway/DatabaseGateway";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const localDatabaseNames = new Set(["local_db", "test_db"]);
const allowedUrlParameters = new Set([
  "sslmode",
  "sslrootcert",
  "channel_binding",
  "application_name",
  "connect_timeout",
]);
const allowedStartupParameters = new Set([
  "application_name",
  "sslrootcert",
  "channel_binding",
]);

export interface ResetDatabaseGateway extends DatabaseGateway {
  readonly sql: DatabaseGatewaySql & {
    readonly options: {
      host: string[];
      database: string;
      user: string;
      path?: string;
      connection: Record<string, unknown>;
    };
  };
}

interface TestDatabaseTarget {
  hostname: string;
  databaseName: string;
}

export function createTestDatabase(
  config: DatabaseConfig,
  mode: string | undefined,
  allowedHost?: string,
): Database {
  const target = assertTestDatabaseTarget(config, mode, allowedHost);
  let database: Database;
  try {
    database = new Database(config.connectionString, { onnotice: () => {} });
  } catch {
    throw new Error("Cannot initialize the allowed test database connection");
  }
  try {
    assertDatabaseClientTarget(database, target);
    return database;
  } catch (error) {
    void database.close();
    throw error;
  }
}

export async function wipeTestDatabase(
  database: ResetDatabaseGateway,
  config: DatabaseConfig,
  mode: string | undefined,
  allowedHost?: string,
): Promise<void> {
  const target = assertTestDatabaseTarget(config, mode, allowedHost);
  assertDatabaseClientTarget(database, target);
  // Check and reset on the same connection; pooled connections must not differ.
  await database.transaction(async (sql) => {
    const rows = await sql<{ database_name: string }[]>`
      SELECT current_database() AS database_name
    `;
    if (rows.length !== 1 || rows[0].database_name !== target.databaseName) {
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
  allowedHost: string | undefined,
): TestDatabaseTarget {
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

function assertDatabaseClientTarget(
  database: ResetDatabaseGateway,
  target: TestDatabaseTarget,
): void {
  const options = database.sql.options;
  // Startup parameters can override the driver's parsed database or Neon route.
  if (
    options.host.length !== 1 ||
    options.host[0] !== target.hostname ||
    options.database !== target.databaseName ||
    options.user.includes("\0") ||
    options.path ||
    Object.entries(options.connection).some(
      ([key, value]) =>
        !allowedStartupParameters.has(key) ||
        (typeof value === "string" && value.includes("\0")),
    )
  ) {
    throw new Error("Database client does not match the allowed reset target");
  }
}
