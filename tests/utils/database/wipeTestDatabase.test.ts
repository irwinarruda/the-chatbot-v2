import { afterEach, describe, expect, test, vi } from "vitest";
import type { DatabaseGatewaySql } from "~/shared/gateway/DatabaseGateway";
import {
  createTestDatabase,
  type ResetDatabaseGateway,
  wipeTestDatabase,
} from "~/tests/utils/database/wipeTestDatabase";

class ResetDatabaseFake implements ResetDatabaseGateway {
  readonly statements: string[] = [];
  readonly sql: ResetDatabaseGateway["sql"];
  transactions = 0;
  identityError: Error | undefined;
  identityRows: { database_name: string }[];
  private transactionSql: DatabaseGatewaySql;

  constructor(databaseName: string, hostname = "localhost") {
    this.identityRows = [{ database_name: databaseName }];
    this.sql = Object.assign(
      () => {
        throw new Error("Reset must use the transaction connection");
      },
      {
        options: {
          host: [hostname],
          database: databaseName,
          user: "test_user",
          connection: {},
        },
      },
    ) as unknown as ResetDatabaseGateway["sql"];
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
  afterEach(() => vi.unstubAllEnvs());

  test("initializes an allowed local client without opening a connection", async () => {
    const database = createTestDatabase(
      { name: "local_db", connectionString: "postgres://localhost/local_db" },
      "test",
    );
    expect(database.sql.options.host).toEqual(["localhost"]);
    expect(database.sql.options.database).toBe("local_db");
    await database.close();
  });

  test("initializes neondb only on an independently allowed preview host", async () => {
    const hostname = "preview-pooler.example.invalid";
    const database = createTestDatabase(
      {
        name: "neondb",
        connectionString: `postgres://${hostname}/neondb?sslmode=require&channel_binding=require`,
      },
      "preview",
      hostname,
    );
    expect(database.sql.options.host).toEqual([hostname]);
    expect(database.sql.options.database).toBe("neondb");
    await database.close();
  });

  test("uses the explicit target even when PostgreSQL environment defaults differ", async () => {
    vi.stubEnv("PGHOST", "production.example.invalid");
    vi.stubEnv("PGDATABASE", "production");
    vi.stubEnv("PGOPTIONS", "-c database=production");
    const database = createTestDatabase(
      { name: "local_db", connectionString: "postgres://localhost/local_db" },
      "test",
    );
    expect(database.sql.options.host).toEqual(["localhost"]);
    expect(database.sql.options.database).toBe("local_db");
    expect(database.sql.options.connection).not.toHaveProperty("options");
    await database.close();
  });

  test.each([
    undefined,
    "",
    "production.example.invalid",
    "*.example.invalid",
    "https://preview.example.invalid",
    "preview.example.invalid:5432",
    "preview.example.invalid,production.example.invalid",
  ])(
    "refuses neondb without an exact allowed host: %s",
    async (allowedHost) => {
      const config = {
        name: "neondb",
        connectionString: "postgres://preview.example.invalid/neondb",
      };
      expect(() =>
        createTestDatabase(config, "preview", allowedHost),
      ).toThrow();
      const database = new ResetDatabaseFake(
        "neondb",
        "preview.example.invalid",
      );
      await expect(
        wipeTestDatabase(database, config, "preview", allowedHost),
      ).rejects.toThrow();
      expect(database.transactions).toBe(0);
    },
  );

  test("refuses the production host even when both databases are neondb", () => {
    expect(() =>
      createTestDatabase(
        {
          name: "neondb",
          connectionString: "postgres://production.example.invalid/neondb",
        },
        "preview",
        "preview.example.invalid",
      ),
    ).toThrow("host does not match TEST_DATABASE_ALLOWED_HOST");
  });

  test("does not fall back to the legacy preview name when the allowed host differs", () => {
    expect(() =>
      createTestDatabase(
        {
          name: "preview",
          connectionString: "postgres://production.example.invalid/preview",
        },
        "preview",
        "preview.example.invalid",
      ),
    ).toThrow("host does not match TEST_DATABASE_ALLOWED_HOST");
  });

  test.each([
    "database=production",
    "dbname=production",
    "host=production.example.invalid",
    "hostaddr=192.0.2.1",
    "options=endpoint%3Dproduction",
    "options=-c%20database%3Dproduction",
    "user=production_owner",
    "port=9999",
    "application_name=tests%00options%00endpoint%3Dproduction",
  ])(
    "refuses URL connection overrides before constructing a client: %s",
    async (query) => {
      const config = {
        name: "neondb",
        connectionString: `postgres://preview.example.invalid/neondb?${query}`,
      };
      const hostname = "preview.example.invalid";
      expect(() => createTestDatabase(config, "preview", hostname)).toThrow(
        "unsupported connection options",
      );
      const database = new ResetDatabaseFake("neondb", hostname);
      await expect(
        wipeTestDatabase(database, config, "preview", hostname),
      ).rejects.toThrow("unsupported connection options");
      expect(database.transactions).toBe(0);
    },
  );

  test.each([
    { host: ["production.example.invalid"] },
    { host: ["preview.example.invalid", "production.example.invalid"] },
    { database: "production" },
    { path: "/tmp/.s.PGSQL.5432" },
    { connection: { database: "production" } },
    { connection: { options: "endpoint=production" } },
    { connection: { application_name: "tests\0options\0endpoint=production" } },
    { user: "user\0options\0endpoint=production" },
  ])(
    "refuses an effective driver target that differs from the checked URL",
    async (options) => {
      const hostname = "preview.example.invalid";
      const database = new ResetDatabaseFake("neondb", hostname);
      Object.assign(database.sql.options, options);
      await expect(
        wipeTestDatabase(
          database,
          { name: "neondb", connectionString: `postgres://${hostname}/neondb` },
          "preview",
          hostname,
        ),
      ).rejects.toThrow(
        "Database client does not match the allowed reset target",
      );
      expect(database.transactions).toBe(0);
    },
  );

  test("rejects differing URL and driver database parsing without connecting", () => {
    expect(() =>
      createTestDatabase(
        {
          name: "local_db",
          connectionString: "postgres://localhost/%6cocal_db",
        },
        "test",
      ),
    ).toThrow("Database client does not match the allowed reset target");
  });

  test("refuses startup parameter injection through encoded user information", () => {
    expect(() =>
      createTestDatabase(
        {
          name: "neondb",
          connectionString:
            "postgres://user%00options%00endpoint%3Dproduction:password@preview.example.invalid/neondb",
        },
        "preview",
        "preview.example.invalid",
      ),
    ).toThrow("unsupported connection options");
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
    ["test", "localhost", "local_db", undefined],
    ["test", "127.0.0.1", "test_db", undefined],
    ["development", "[::1]", "local_db", undefined],
    ["preview", "preview.example.invalid", "preview", undefined],
    ["preview", "preview.example.invalid", "neondb", "preview.example.invalid"],
  ])(
    "resets %s on an allowed target",
    async (mode, hostname, name, allowedHost) => {
      const database = new ResetDatabaseFake(name, hostname);
      await wipeTestDatabase(
        database,
        { name, connectionString: `postgresql://${hostname}/${name}` },
        mode,
        allowedHost,
      );
      expect(database.transactions).toBe(1);
      expect(database.statements).toEqual([
        "SELECT current_database() AS database_name",
        "DROP SCHEMA public CASCADE",
        "CREATE SCHEMA public",
      ]);
    },
  );

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
    const database = new ResetDatabaseFake(
      "preview",
      "preview.example.invalid",
    );
    database.identityRows = [{ database_name: "production" }];
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
