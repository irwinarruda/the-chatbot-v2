export interface MigrationsGateway {
  listPending(): Promise<string[]>;
  runPending(): Promise<string[]>;
  resetAll(): Promise<void>;
}
