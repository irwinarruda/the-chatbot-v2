import type postgres from "postgres";

export interface DatabaseExecutor {
  readonly sql: postgres.Sql;
  json(value: unknown): postgres.Parameter;
  transaction<T>(cb: (sql: postgres.Sql) => T | Promise<T>): Promise<T>;
}
