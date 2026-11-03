import { Status } from "~/domain/system/status";
import type { DatabaseStatusRepository } from "~/server/modules/system/repositories/database-status.repository";
import type {
  AiConfig,
  DatabaseConfig,
  DeploymentConfig,
} from "~/server/shared/config/config";

export class StatusService {
  constructor(
    private databaseStatus: DatabaseStatusRepository,
    private databaseConfig: DatabaseConfig,
    private aiConfig: AiConfig,
    private deploymentConfig: DeploymentConfig,
  ) {}

  async getStatus(): Promise<Status> {
    const { version, maxConnections, openConnections } =
      await this.databaseStatus.read(this.databaseConfig.name);
    return new Status(
      version,
      maxConnections,
      openConnections,
      this.aiConfig.model,
      this.deploymentConfig.commitSha,
    );
  }
}
