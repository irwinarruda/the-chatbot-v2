import { execFileSync } from "child_process";
import { join, resolve } from "path";
import { loadModeEnv, resolveMode } from "../../plugins/env";
import { prepareMigrationCommand } from "./migration-preflight";

const root = resolve(import.meta.dirname, "..", "..");
const mode = resolveMode(process.env.MODE ?? "development");
const args = process.argv.slice(2);

loadModeEnv(mode, root);

const migrationsDir = join(root, "infra", "migrations");
const command = prepareMigrationCommand(mode, process.env, args, migrationsDir);
try {
  execFileSync("node-pg-migrate", command.args, {
    stdio: "pipe",
    cwd: root,
    env: command.env,
  });
  console.log("Database migration command completed.");
} catch {
  console.error(
    "Database migration command failed. Output withheld to protect credentials.",
  );
  process.exitCode = 1;
}
