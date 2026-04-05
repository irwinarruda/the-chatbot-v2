import { registerDependencies } from "~/infra/bootstrap";
import { loadConfig } from "~/infra/config";
import { container } from "~/infra/container";

let bootstrapPromise: Promise<void> | null = null;

function bootstrapApp(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const config = loadConfig();
      registerDependencies(config);
      resolve();
    } catch (error) {
      bootstrapPromise = null;
      reject(error);
    }
  });
}

export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapApp();
  }
  return bootstrapPromise;
}

export function getService<T>(name: string): T {
  return container.resolve<T>(name);
}
