import fs from "fs";
import { runner } from "node-pg-migrate";
import type { MigrationsGateway } from "~/server/modules/system/gateways/migrations";
import type { DatabaseConfig } from "~/server/shared/config/config";
import { Paths } from "~/server/shared/config/paths";
import type { DatabaseGateway } from "~/server/shared/database/database";

const noop = () => {};
const noopLogger = { debug: noop, info: noop, warn: noop, error: noop };
const UNDEFINED_TABLE_ERROR_CODE = "42P01";

type PostgresErrorLike = {
  code?: string;
};

export class NodePgMigrationsGateway implements MigrationsGateway {
  constructor(
    private readonly database: DatabaseGateway,
    private readonly databaseConfig: DatabaseConfig,
  ) {}

  async listPending(): Promise<string[]> {
    const files = fs.readdirSync(Paths.migrationsDir());
    const allFiles = files
      .filter((f) => /^\d+_.+\.(ts|js)$/.test(f))
      .sort()
      .map((f) => f.replace(/\.(ts|js)$/, ""));
    const applied = await this.appliedNames();
    return allFiles.filter((f) => !applied.includes(f));
  }

  async runPending(): Promise<string[]> {
    const result = await runner({
      databaseUrl: this.databaseConfig.connectionString,
      dir: Paths.migrationsDir(),
      direction: "up",
      migrationsTable: "pgmigrations",
      noLock: true,
      logger: noopLogger,
    });
    return result.map((m) => m.name);
  }

  async resetAll(): Promise<void> {
    const appliedCount = (await this.appliedNames()).length;
    if (appliedCount === 0) return;
    await runner({
      databaseUrl: this.databaseConfig.connectionString,
      dir: Paths.migrationsDir(),
      direction: "down",
      migrationsTable: "pgmigrations",
      count: appliedCount,
      noLock: true,
      logger: noopLogger,
    });
  }

  private async appliedNames(): Promise<string[]> {
    try {
      const rows = await this.database.sql.unsafe<{ name: string }[]>(
        "SELECT name FROM pgmigrations ORDER BY run_on",
      );
      return rows.map((r) => r.name);
    } catch (error) {
      if ((error as PostgresErrorLike).code !== UNDEFINED_TABLE_ERROR_CODE) {
        throw error;
      }
      return [];
    }
  }
}
