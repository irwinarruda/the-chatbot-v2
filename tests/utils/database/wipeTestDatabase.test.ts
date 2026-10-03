import { describe, expect, test } from "vitest";
import type {
  DatabaseGateway,
  DatabaseGatewaySql,
} from "~/shared/gateway/DatabaseGateway";
import {
  createTestDatabase,
  wipeTestDatabase,
} from "~/tests/utils/database/wipeTestDatabase";

class ResetDatabaseFake implements DatabaseGateway {
  readonly statements: string[] = [];
  readonly sql: DatabaseGatewaySql;
  transactions = 0;
  identityError: Error | undefined;
  identityRows: { database_name: string }[];
  private transactionSql: DatabaseGatewaySql;

  constructor(databaseName: string) {
    this.identityRows = [{ database_name: databaseName }];
    this.sql = (() => {
      throw new Error("Reset must use the transaction connection");
    }) as unknown as DatabaseGatewaySql;
    this.transactionSql = (async (strings: TemplateStringsArray) => {
      const statement = strings.join("?").trim();
      this.statements.push(statement);
      if (statement === "SELECT current_database() AS database_name") {
        if (this.identityError) throw this.identityError;
        return this.identityRows;
      }
      if (
        statement === "DROP SCHEMA public CASCADE" ||
        statement === "CREATE SCHEMA public"
      ) {
        return [];
      }
      throw new Error(`Unexpected SQL: ${statement}`);
    }) as unknown as DatabaseGatewaySql;
  }

  json(): never {
    throw new Error("JSON parameters are not used by this fake");
  }

  async transaction<T>(
    callback: (sql: DatabaseGatewaySql) => T | Promise<T>,
  ): Promise<T> {
    this.transactions++;
    return callback(this.transactionSql);
  }
}

describe("test database reset safety", () => {
  test("initializes an allowed local client without opening a connection", async () => {
    const database = createTestDatabase(
      { name: "local_db", connectionString: "postgres://localhost/local_db" },
      "test",
    );
    expect(database.sql.options.host).toEqual(["localhost"]);
    expect(database.sql.options.database).toBe("local_db");
    await database.close();
  });

  test("rejects ambiguous credentials before postgres.js can parse a remote host", async () => {
    const config = {
      name: "local_db",
      connectionString:
        "postgres://user:part@remote.example.invalid,tail@localhost/local_db",
    };
    expect(() => createTestDatabase(config, "test")).toThrow(
      "requires an unambiguous single-host URL",
    );
    const database = new ResetDatabaseFake("local_db");
    await expect(wipeTestDatabase(database, config, "test")).rejects.toThrow(
      "requires an unambiguous single-host URL",
    );
    expect(database.transactions).toBe(0);
    expect(database.statements).toEqual([]);
  });

  test.each([
    [
      "postgres://user:do-not-print@",
      "Database reset requires a valid PostgreSQL connection URL",
    ],
    [
      "postgres://user:do-not-print%ZZ@localhost/local_db",
      "Cannot initialize the allowed test database connection",
    ],
  ])("sanitizes client initialization errors", (connectionString, message) => {
    let failure: unknown;
    try {
      createTestDatabase({ name: "local_db", connectionString }, "test");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({ message });
    expect(failure).not.toHaveProperty("input");
    expect(failure).not.toHaveProperty("cause");
    expect(JSON.stringify(failure)).not.toContain("do-not-print");
  });

  test.each([
    ["test", "localhost", "local_db"],
    ["test", "127.0.0.1", "test_db"],
    ["development", "[::1]", "local_db"],
    ["preview", "preview.example.invalid", "preview"],
  ])("resets %s on an allowed target", async (mode, hostname, name) => {
    const database = new ResetDatabaseFake(name);
    await wipeTestDatabase(
      database,
      { name, connectionString: `postgresql://${hostname}/${name}` },
      mode,
    );
    expect(database.transactions).toBe(1);
    expect(database.statements).toEqual([
      "SELECT current_database() AS database_name",
      "DROP SCHEMA public CASCADE",
      "CREATE SCHEMA public",
    ]);
  });

  test.each([undefined, "", "production", "staging"])(
    "rejects unsafe mode %s before querying",
    async (mode) => {
      const database = new ResetDatabaseFake("local_db");
      await expect(
        wipeTestDatabase(
          database,
          {
            name: "local_db",
            connectionString: "postgres://localhost/local_db",
          },
          mode,
        ),
      ).rejects.toThrow("requires test, development, or preview mode");
      expect(database.transactions).toBe(0);
      expect(database.statements).toEqual([]);
    },
  );

  test.each([
    ["test", "postgres://remote.example.invalid/local_db", "local_db"],
    ["development", "postgres://remote.example.invalid/test_db", "test_db"],
    ["test", "postgres://localhost/production", "production"],
    ["development", "postgres://localhost/production", "production"],
    ["preview", "postgres://remote.example.invalid/production", "production"],
    ["preview", "postgres://remote.example.invalid/Production", "Production"],
    ["test", "postgres://localhost/preview", "preview"],
    ["preview", "postgres://localhost/local_db", "local_db"],
    ["preview", "postgres://remote.example.invalid/production", "preview"],
    ["preview", "postgres://remote.example.invalid/preview", "production"],
    ["test", "postgres://localhost/other", "other"],
    ["test", "postgres://localhost/", "local_db"],
    ["test", "https://localhost/local_db", "local_db"],
  ])(
    "rejects disallowed %s target %s",
    async (mode, connectionString, name) => {
      const database = new ResetDatabaseFake(name);
      await expect(
        wipeTestDatabase(database, { name, connectionString }, mode),
      ).rejects.toThrow();
      expect(database.transactions).toBe(0);
      expect(database.statements).toEqual([]);
    },
  );

  test("refuses a production connection disguised as preview", async () => {
    const database = new ResetDatabaseFake("production");
    await expect(
      wipeTestDatabase(
        database,
        {
          name: "preview",
          connectionString: "postgres://preview.example.invalid/preview",
        },
        "preview",
      ),
    ).rejects.toThrow("Connected database does not match");
    expect(database.statements).toEqual([
      "SELECT current_database() AS database_name",
    ]);
  });

  test("refuses a missing database identity", async () => {
    const database = new ResetDatabaseFake("local_db");
    database.identityRows = [];
    await expect(
      wipeTestDatabase(
        database,
        { name: "local_db", connectionString: "postgres://localhost/local_db" },
        "test",
      ),
    ).rejects.toThrow("Connected database does not match");
    expect(database.statements).toEqual([
      "SELECT current_database() AS database_name",
    ]);
  });

  test("does not reset when the identity query fails", async () => {
    const database = new ResetDatabaseFake("local_db");
    database.identityError = new Error("Identity query failed");
    await expect(
      wipeTestDatabase(
        database,
        { name: "local_db", connectionString: "postgres://localhost/local_db" },
        "test",
      ),
    ).rejects.toThrow("Identity query failed");
    expect(database.statements).toEqual([
      "SELECT current_database() AS database_name",
    ]);
  });

  test.each(["postgres://user:do-not-print@", "postgres://localhost/%ZZ"])(
    "sanitizes invalid connection errors",
    async (connectionString) => {
      const database = new ResetDatabaseFake("local_db");
      await expect(
        wipeTestDatabase(
          database,
          { name: "local_db", connectionString },
          "test",
        ),
      ).rejects.toThrow(
        "Database reset requires a valid PostgreSQL connection URL",
      );
      expect(database.statements).toEqual([]);
    },
  );
});
