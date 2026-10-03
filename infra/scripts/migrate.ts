import { execFileSync } from "child_process";
import { join, resolve } from "path";
import { loadModeEnv, resolveMode } from "../../plugins/env";
import { assertMigrationPreflight } from "./migration-preflight";

const root = resolve(import.meta.dirname, "..", "..");
const mode = resolveMode(process.env.MODE ?? "development");
const args = process.argv.slice(2);

loadModeEnv(mode, root);
assertMigrationPreflight(mode, process.env, args);

const migrationsDir = join(root, "infra", "migrations");
try {
  execFileSync(
    "node-pg-migrate",
    ["--migrations-dir", migrationsDir, ...args],
    {
      stdio: "pipe",
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_CONNECTION_STRING,
      },
    },
  );
  console.log("Database migration command completed.");
} catch {
  console.error(
    "Database migration command failed. Output withheld to protect credentials.",
  );
  process.exitCode = 1;
}
