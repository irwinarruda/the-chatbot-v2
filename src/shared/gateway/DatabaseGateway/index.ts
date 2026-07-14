import type postgres from "postgres";

export interface DatabaseGateway {
  readonly sql: postgres.Sql;
  json(value: unknown): postgres.Parameter;
  transaction<T>(cb: (sql: postgres.Sql) => T | Promise<T>): Promise<T>;
}
