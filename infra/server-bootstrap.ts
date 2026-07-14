import { type Application, createApplication } from "~/infra/bootstrap";
import { loadConfig } from "~/shared/config/Config";

export class ServerBootstrap {
  private static application: Application | undefined;

  static ensureBootstrapped(): Promise<void> {
    ServerBootstrap.getApplication();
    return Promise.resolve();
  }

  static getApplication(): Application {
    ServerBootstrap.application ??= createApplication(loadConfig());
    return ServerBootstrap.application;
  }
}
