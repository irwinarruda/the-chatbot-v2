import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { devNull, tmpdir } from "os";
import { join, resolve } from "path";
import { describe, expect, test } from "vitest";
import { prepareMigrationCommand } from "~/infra/scripts/migration-preflight";

const require = createRequire(import.meta.url);
const cliPath = require.resolve("node-pg-migrate/bin/node-pg-migrate");
const probePath = resolve(
  import.meta.dirname,
  "fixtures",
  "migration-child-probe.cjs",
);

function probeConfiguration(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) {
  const output = execFileSync(
    "node",
    ["--require", probePath, cliPath, ...args],
    {
      cwd,
      env,
      encoding: "utf8",
      timeout: 10_000,
    },
  );
  const result = output.match(/MIGRATION_PROBE:(.+)/)?.[1];
  if (!result) throw new Error("Migration CLI did not reach the guarded probe");
  return JSON.parse(result);
}

describe("migration child configuration", () => {
  test.each(["modern", "legacy", "default"])(
    "prevents a second dotenv load through %s configuration",
    (configuration) => {
      const directory = mkdtempSync(join(tmpdir(), "migration-dotenv-"));
      try {
        let fixturePath = join(directory, "injected.env");
        if (configuration === "default") fixturePath = join(directory, ".env");
        writeFileSync(
          fixturePath,
          "DATABASE_URL=postgres://production.example.invalid/neondb\nPGOPTIONS=endpoint=production\n",
        );
        const env: NodeJS.ProcessEnv = {
          PATH: process.env.PATH,
          DATABASE_NAME: "local_db",
          DATABASE_CONNECTION_STRING: "postgres://localhost/local_db",
          MIGRATION_PROBE_EXPECTED_HOST: "localhost",
          MIGRATION_PROBE_EXPECTED_DATABASE: "local_db",
          MIGRATION_PROBE_ENV_PATH: fixturePath,
        };
        if (configuration === "modern") {
          env.DOTENV_PATH = fixturePath;
          env.DOTENV_OVERRIDE = "true";
          env.DOTENV_CONFIG_PATH = fixturePath;
          env.DOTENV_CONFIG_OVERRIDE = "true";
        } else if (configuration === "legacy") {
          env.DOTENV_CONFIG_PATH = fixturePath;
          env.DOTENV_CONFIG_OVERRIDE = "true";
        }
        const command = prepareMigrationCommand(
          "test",
          env,
          ["up"],
          join(directory, "migrations"),
        );
        expect(command.args.slice(-2)).toEqual(["--envPath", devNull]);
        expect(
          probeConfiguration(directory, command.args, command.env),
        ).toEqual({
          fixtureRead: false,
          targetPreserved: true,
          optionsAbsent: true,
          dotenvControlsAbsent: true,
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  test("the real CLI probe detects an unguarded dotenv target override", () => {
    const directory = mkdtempSync(join(tmpdir(), "migration-dotenv-control-"));
    try {
      const fixturePath = join(directory, "injected.env");
      writeFileSync(
        fixturePath,
        "DATABASE_URL=postgres://production.example.invalid/neondb\nPGOPTIONS=endpoint=production\n",
      );
      expect(
        probeConfiguration(directory, ["up"], {
          PATH: process.env.PATH,
          DATABASE_URL: "postgres://localhost/local_db",
          DOTENV_PATH: fixturePath,
          DOTENV_OVERRIDE: "true",
          MIGRATION_PROBE_EXPECTED_HOST: "localhost",
          MIGRATION_PROBE_EXPECTED_DATABASE: "local_db",
          MIGRATION_PROBE_ENV_PATH: fixturePath,
        }),
      ).toEqual({
        fixtureRead: true,
        targetPreserved: false,
        optionsAbsent: false,
        dotenvControlsAbsent: false,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("preserves the explicit production target without reloading dotenv", () => {
    const command = prepareMigrationCommand(
      "production",
      {
        DATABASE_CONNECTION_STRING:
          "postgres://production.example.invalid/neondb",
        DOTENV_PATH: "/synthetic/other.env",
        DOTENV_OVERRIDE: "true",
      },
      ["up"],
      "/synthetic/migrations",
    );
    expect(command.env.DATABASE_URL).toBe(
      "postgres://production.example.invalid/neondb",
    );
    expect(command.env).not.toHaveProperty("DOTENV_PATH");
    expect(command.env).not.toHaveProperty("DOTENV_OVERRIDE");
    expect(command.args.slice(-2)).toEqual(["--envPath", devNull]);
  });

  test("does not allow production arguments to add a second environment file", () => {
    expect(() =>
      prepareMigrationCommand(
        "production",
        {},
        ["up", "--envPath=/synthetic/other.env"],
        "/synthetic/migrations",
      ),
    ).toThrow("environment is already loaded");
  });
});
