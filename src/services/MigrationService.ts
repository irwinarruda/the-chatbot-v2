import type { AuthConfig, DatabaseConfig } from "@infra/config";
import type { Database } from "@infra/database";
import { UnauthorizedException } from "@infra/exceptions";
import { resolveMigrationsDir } from "@infra/paths";
import fs from "fs";
import { runner } from "node-pg-migrate";

const migrationsDir = resolveMigrationsDir();

const noop = () => {};
const noopLogger = { debug: noop, info: noop, warn: noop, error: noop };

export class MigrationService {
  private database: Database;
  private databaseConfig: DatabaseConfig;
  private authConfig: AuthConfig;

  constructor(
    database: Database,
    databaseConfig: DatabaseConfig,
    authConfig: AuthConfig,
  ) {
    this.database = database;
    this.databaseConfig = databaseConfig;
    this.authConfig = authConfig;
  }

  async listPendingMigrations(): Promise<string[]> {
    const allFiles = this.getMigrationFiles();
    let applied: string[] = [];
    try {
      const rows = await this.database.sql<
        { name: string }[]
      >`SELECT name FROM pgmigrations ORDER BY run_on`;
      applied = rows.map((r) => r.name);
    } catch {
      // pgmigrations table doesn't exist yet (e.g. after wipe) — all are pending
    }
    return allFiles.filter((f) => !applied.includes(f));
  }

  async runPendingMigrations(hashPassword?: string): Promise<string[]> {
    if (this.authConfig.hashPassword !== hashPassword) {
      throw new UnauthorizedException("Invalid password");
    }
    const result = await runner({
      databaseUrl: this.databaseConfig.connectionString,
      dir: migrationsDir,
      direction: "up",
      migrationsTable: "pgmigrations",
      noLock: true,
      logger: noopLogger,
    });
    return result.map((m) => m.name);
  }

  async resetMigrations(hashPassword?: string): Promise<void> {
    if (this.authConfig.hashPassword !== hashPassword) {
      throw new UnauthorizedException("Invalid password");
    }
    let appliedCount = 0;
    try {
      const rows = await this.database.sql<
        { count: string }[]
      >`SELECT COUNT(*)::text as count FROM pgmigrations`;
      appliedCount = parseInt(rows[0].count, 10);
    } catch {
      return;
    }
    if (appliedCount === 0) return;
    await runner({
      databaseUrl: this.databaseConfig.connectionString,
      dir: migrationsDir,
      direction: "down",
      migrationsTable: "pgmigrations",
      count: appliedCount,
      noLock: true,
      logger: noopLogger,
    });
  }

  private getMigrationFiles(): string[] {
    const files = fs.readdirSync(migrationsDir);
    return files
      .filter((f) => /^\d+_.+\.(ts|js)$/.test(f))
      .sort()
      .map((f) => f.replace(/\.(ts|js)$/, ""));
  }
}
