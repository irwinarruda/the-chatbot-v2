import type { AiConfig, DatabaseConfig } from "~/infra/config";
import type { Database } from "~/infra/database";
import { Status } from "~/shared/entities/Status";

export class StatusService {
  private database: Database;
  private databaseConfig: DatabaseConfig;
  private aiConfig: AiConfig;

  constructor(
    database: Database,
    databaseConfig: DatabaseConfig,
    aiConfig: AiConfig,
  ) {
    this.database = database;
    this.databaseConfig = databaseConfig;
    this.aiConfig = aiConfig;
  }

  async getStatus(): Promise<Status> {
    const versionResult = await this.database.sql`SHOW server_version`;
    const maxConnectionsResult = await this.database.sql`SHOW max_connections`;
    const openConnectionsResult = await this.database.sql<{ count: string }[]>`
      SELECT count(*)::text FROM pg_stat_activity
      WHERE datname = ${this.databaseConfig.name}
    `;
    const version = versionResult[0]?.server_version ?? "unknown";
    const maxConnections = parseInt(
      maxConnectionsResult[0]?.max_connections ?? "0",
      10,
    );
    const openConnections = parseInt(
      openConnectionsResult[0]?.count ?? "0",
      10,
    );
    return new Status(
      version,
      maxConnections,
      openConnections,
      this.aiConfig.model,
    );
  }
}
