import type { DatabaseGateway } from "~/server/shared/database/database";

export interface DatabaseStatus {
  version: string;
  maxConnections: number;
  openConnections: number;
}

export class DatabaseStatusRepository {
  constructor(private readonly database: DatabaseGateway) {}

  async read(databaseName: string): Promise<DatabaseStatus> {
    const versionResult = await this.database.sql`SHOW server_version`;
    const maxConnectionsResult = await this.database.sql`SHOW max_connections`;
    const openConnectionsResult = await this.database.sql<{ count: string }[]>`
      SELECT count(*)::text FROM pg_stat_activity
      WHERE datname = ${databaseName}
    `;
    return {
      version: versionResult[0]?.server_version ?? "unknown",
      maxConnections: parseInt(
        maxConnectionsResult[0]?.max_connections ?? "0",
        10,
      ),
      openConnections: parseInt(openConnectionsResult[0]?.count ?? "0", 10),
    };
  }
}
