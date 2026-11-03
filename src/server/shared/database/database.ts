import type postgres from "postgres";

export type DatabaseGatewaySql = postgres.ISql;
export type DatabaseGatewayParameter = postgres.Parameter;

export interface DatabaseGateway {
  readonly sql: DatabaseGatewaySql;
  json(value: unknown): DatabaseGatewayParameter;
  transaction<T>(cb: (sql: DatabaseGatewaySql) => T | Promise<T>): Promise<T>;
}
