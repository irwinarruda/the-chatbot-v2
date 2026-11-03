import type { MigrationsGateway } from "~/server/modules/system/gateways/migrations";
import type { AuthConfig } from "~/server/shared/config/config";
import { UnauthorizedException } from "~/server/shared/errors/application-errors";

export class MigrationService {
  constructor(
    private migrations: MigrationsGateway,
    private authConfig: AuthConfig,
  ) {}

  async listPendingMigrations(): Promise<string[]> {
    return this.migrations.listPending();
  }

  async runPendingMigrations(hashPassword?: string): Promise<string[]> {
    this.requirePassword(hashPassword);
    return this.migrations.runPending();
  }

  async resetMigrations(hashPassword?: string): Promise<void> {
    this.requirePassword(hashPassword);
    await this.migrations.resetAll();
  }

  private requirePassword(hashPassword?: string): void {
    if (this.authConfig.hashPassword !== hashPassword) {
      throw new UnauthorizedException("Invalid password");
    }
  }
}
