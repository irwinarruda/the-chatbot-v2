import { execSync } from "child_process";
import { config } from "dotenv";
import { join, resolve } from "path";

const root = resolve(import.meta.dirname, "..", "..", "..");
const mode = process.env.MODE ?? "local";

config({ path: join(root, ".env") });
config({ path: join(root, `.env.${mode}`), override: true });

if (!process.env.DATABASE_URL && process.env.DATABASE_CONNECTION_STRING) {
  process.env.DATABASE_URL = process.env.DATABASE_CONNECTION_STRING;
}

const migrationsDir = join(root, "src", "infra", "migrations");
const args = process.argv.slice(2).join(" ");
execSync(`node-pg-migrate --migrations-dir ${migrationsDir} ${args}`, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
