import postgres from "postgres";
import type { DatabaseGateway } from "~/shared/gateway/DatabaseGateway";

export class Database implements DatabaseGateway {
  readonly sql: postgres.Sql;

  constructor(
    connectionString: string,
    options?: postgres.Options<Record<string, postgres.PostgresType>>,
  ) {
    this.sql = postgres(connectionString, {
      ...options,
      prepare: options?.prepare ?? false,
      transform: {
        ...options?.transform,
        undefined: null,
      },
    });
  }

  json(value: unknown): postgres.Parameter {
    return this.sql.json(value as postgres.JSONValue);
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  async transaction<T>(cb: (sql: postgres.Sql) => T | Promise<T>): Promise<T> {
    return this.sql.begin((sql) =>
      cb(sql as unknown as postgres.Sql),
    ) as Promise<T>;
  }
}
