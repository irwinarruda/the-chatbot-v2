import { registerDependencies } from "./bootstrap";
import { loadConfig } from "./config";
import { container } from "./container";

export class ServerBootstrap {
  private static bootstrapPromise: Promise<void> | null = null;

  static ensureBootstrapped(): Promise<void> {
    if (!ServerBootstrap.bootstrapPromise) {
      ServerBootstrap.bootstrapPromise = ServerBootstrap.bootstrapApp();
    }
    return ServerBootstrap.bootstrapPromise;
  }

  static getService<T>(name: string): T {
    return container.resolve<T>(name);
  }

  private static bootstrapApp(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const config = loadConfig();
        registerDependencies(config);
        resolve();
      } catch (error) {
        ServerBootstrap.bootstrapPromise = null;
        reject(error);
      }
    });
  }
}
