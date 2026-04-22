import { execSync } from "child_process";
import { join, resolve } from "path";
import { loadModeEnv, resolveMode } from "../../plugins/env";

const root = resolve(import.meta.dirname, "..", "..");
const mode = resolveMode(process.env.MODE ?? "development");
const args = process.argv.slice(2);

loadModeEnv(mode, root);

process.env.DATABASE_URL = process.env.DATABASE_CONNECTION_STRING;

const migrationsDir = join(root, "infra", "migrations");
const migrationArgs = args.join(" ");
execSync(`node-pg-migrate --migrations-dir ${migrationsDir} ${migrationArgs}`, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
