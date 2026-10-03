import { describe, expect, test } from "vitest";
import { assertMigrationPreflight } from "~/infra/scripts/migration-preflight";

describe("migration preflight", () => {
  test.each([
    ["test", "localhost", "local_db"],
    ["test", "127.0.0.1", "test_db"],
    ["development", "localhost", "local_db"],
    ["development", "[::1]", "test_db"],
    ["preview", "preview.example.invalid", "preview"],
  ])("permits the explicit %s target %s/%s", (mode, hostname, name) => {
    expect(() =>
      assertMigrationPreflight(
        mode,
        {
          DATABASE_NAME: name,
          DATABASE_CONNECTION_STRING: `postgres://${hostname}/${name}`,
        },
        ["up"],
      ),
    ).not.toThrow();
  });

  test("permits neondb only with an independent preview host", () => {
    expect(() =>
      assertMigrationPreflight(
        "preview",
        {
          DATABASE_NAME: "neondb",
          DATABASE_CONNECTION_STRING:
            "postgres://preview.example.invalid/neondb?sslmode=require",
          TEST_DATABASE_ALLOWED_HOST: "preview.example.invalid",
        },
        ["up", "--dry-run"],
      ),
    ).not.toThrow();
  });

  test.each(["test", "development"])(
    "refuses remote targets in %s before a migration can be started",
    (mode) => {
      expect(() =>
        assertMigrationPreflight(
          mode,
          {
            DATABASE_NAME: "local_db",
            DATABASE_CONNECTION_STRING:
              "postgres://production.example.invalid/local_db",
            TEST_DATABASE_ALLOWED_HOST: "production.example.invalid",
          },
          ["up"],
        ),
      ).toThrow("requires loopback and local_db or test_db");
    },
  );

  test.each([
    ["production", "postgres://localhost/production"],
    ["local_db", "postgres://localhost/test_db"],
    ["local_db", "postgres://localhost/"],
    ["local_db", "postgres:///local_db"],
    ["local_db", "postgres://localhost,production.example.invalid/local_db"],
    [
      "local_db",
      "postgres://localhost/local_db?host=production.example.invalid",
    ],
    ["local_db", "postgres://localhost/local_db?database=production"],
    ["local_db", "postgres://localhost/local_db?options=endpoint%3Dproduction"],
    ["local_db", "postgres://localhost/local_db#production"],
    ["local_db", ""],
  ])(
    "refuses unsafe or mismatched local configuration",
    (name, connectionString) => {
      expect(() =>
        assertMigrationPreflight(
          "test",
          {
            DATABASE_NAME: name,
            DATABASE_CONNECTION_STRING: connectionString,
          },
          ["up"],
        ),
      ).toThrow();
    },
  );

  test.each([undefined, "", "production.example.invalid"])(
    "refuses neondb without the correct preview allowlist: %s",
    (allowedHost) => {
      expect(() =>
        assertMigrationPreflight(
          "preview",
          {
            DATABASE_NAME: "neondb",
            DATABASE_CONNECTION_STRING:
              "postgres://preview.example.invalid/neondb",
            TEST_DATABASE_ALLOWED_HOST: allowedHost,
          },
          ["up"],
        ),
      ).toThrow();
    },
  );

  test.each(["test", "development", "preview"])(
    "refuses inherited PGOPTIONS in %s",
    (mode) => {
      const env = {
        DATABASE_NAME: "local_db",
        DATABASE_CONNECTION_STRING: "postgres://localhost/local_db",
        PGOPTIONS: "endpoint=production",
      };
      if (mode === "preview") {
        env.DATABASE_NAME = "preview";
        env.DATABASE_CONNECTION_STRING =
          "postgres://preview.example.invalid/preview";
      }
      expect(() => assertMigrationPreflight(mode, env, ["up"])).toThrow(
        "do not accept PGOPTIONS",
      );
    },
  );

  test.each([
    ["--database-url-var", "OTHER_DATABASE"],
    ["--database-url-var=OTHER_DATABASE"],
    ["--databaseUrlVar=OTHER_DATABASE"],
    ["-d", "OTHER_DATABASE"],
    ["-dOTHER_DATABASE"],
    ["--config-file", "production.json"],
    ["--configFile=production.json"],
    ["-fproduction.json"],
    ["--config-value", "production"],
    ["--envPath", ".env.production"],
    ["--env-path=.env.production"],
    ["--new-unreviewed-flag"],
  ])(
    "refuses arguments that could replace the verified configuration",
    (...flags) => {
      expect(() =>
        assertMigrationPreflight(
          "test",
          {
            DATABASE_NAME: "local_db",
            DATABASE_CONNECTION_STRING: "postgres://localhost/local_db",
          },
          ["up", ...flags],
        ),
      ).toThrow(
        "do not accept connection/configuration overrides or unknown flags",
      );
    },
  );

  test("allows migration controls without mutating arguments or environment", () => {
    const env = Object.freeze({
      DATABASE_NAME: "local_db",
      DATABASE_CONNECTION_STRING: "postgres://localhost/local_db",
      DATABASE_URL: "postgres://unrelated.example.invalid/production",
    });
    const args = [
      "down",
      "-1",
      "--dry-run",
      "--schema=public",
      "--no-check-order",
    ];
    const originalArgs = [...args];
    expect(() => assertMigrationPreflight("test", env, args)).not.toThrow();
    expect(args).toEqual(originalArgs);
    expect(env.DATABASE_URL).toBe(
      "postgres://unrelated.example.invalid/production",
    );
  });

  test("preserves explicit production migration authorization", () => {
    expect(() =>
      assertMigrationPreflight(
        "production",
        {
          DATABASE_NAME: "neondb",
          DATABASE_CONNECTION_STRING:
            "postgres://production.example.invalid/neondb",
        },
        ["up"],
      ),
    ).not.toThrow();
  });

  test.each(["", "staging", "Production", "production "])(
    "does not treat an unknown mode as authorized production: %s",
    (mode) => {
      expect(() => assertMigrationPreflight(mode, {}, ["up"])).toThrow();
    },
  );

  test("does not expose connection values in a preflight failure", () => {
    let failure: unknown;
    try {
      assertMigrationPreflight(
        "test",
        {
          DATABASE_NAME: "local_db",
          DATABASE_CONNECTION_STRING: "postgres://user:do-not-print@",
        },
        ["up"],
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain("do-not-print");
    expect(failure).not.toHaveProperty("input");
    expect(failure).not.toHaveProperty("cause");
  });
});
