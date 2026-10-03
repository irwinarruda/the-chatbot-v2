import { Database } from "~/infra/database";
import {
  assertNonProductionDatabaseTarget,
  type NonProductionDatabaseTarget,
} from "~/infra/non-production-database-target";
import type { DatabaseConfig } from "~/shared/config/Config";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/shared/gateway/DatabaseGateway";

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

export function createTestDatabase(
  config: DatabaseConfig,
  mode: string | undefined,
  allowedHost?: string,
): Database {
  const target = assertNonProductionDatabaseTarget(config, mode, allowedHost);
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
  const target = assertNonProductionDatabaseTarget(config, mode, allowedHost);
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

function assertDatabaseClientTarget(
  database: ResetDatabaseGateway,
  target: NonProductionDatabaseTarget,
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
