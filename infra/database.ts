import postgres from "postgres";

export class Database {
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

  async close(): Promise<void> {
    await this.sql.end();
  }
}
