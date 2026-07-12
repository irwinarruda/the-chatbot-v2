import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadModeEnv } from "../../plugins/env";

const root = resolve(import.meta.dirname, "..", "..");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function getDatabaseConnectionString(mode: "development" | "production") {
  loadModeEnv(mode, root);
  const connectionString = process.env.DATABASE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(`DATABASE_CONNECTION_STRING is not configured for ${mode}`);
  }
  return connectionString;
}

function withSystemRootCertificate(connectionString: string) {
  const databaseUrl = new URL(connectionString);
  const sslMode = databaseUrl.searchParams.get("sslmode");
  const verifiesCertificate =
    sslMode === "verify-ca" || sslMode === "verify-full";
  if (verifiesCertificate && !databaseUrl.searchParams.has("sslrootcert")) {
    databaseUrl.searchParams.set("sslrootcert", "system");
  }
  return databaseUrl.toString();
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const subprocess = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    subprocess.on("error", reject);
    subprocess.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${exitCode}`));
    });
  });
}

async function syncProductionDatabase() {
  const productionConnectionString = getDatabaseConnectionString("production");
  const productionDumpConnectionString = withSystemRootCertificate(
    productionConnectionString,
  );
  const localConnectionString = getDatabaseConnectionString("development");
  process.env.MODE = "development";
  const localDatabaseUrl = new URL(localConnectionString);
  if (!localHosts.has(localDatabaseUrl.hostname)) {
    throw new Error(
      `Refusing to replace a non-local database at ${localDatabaseUrl.hostname}`,
    );
  }
  if (productionConnectionString === localConnectionString) {
    throw new Error("Production and local database connection strings match");
  }

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "the-chatbot-production-dump-"),
  );
  const dumpPath = join(temporaryDirectory, "production.dump");

  try {
    console.log("Starting the local PostgreSQL service...");
    await runCommand("bun", ["run", "services:up"]);
    await runCommand("bun", ["infra/scripts/wait-for-postgres.ts"]);

    console.log("Downloading the production database dump...");
    await runCommand("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      `--file=${dumpPath}`,
      productionDumpConnectionString,
    ]);

    console.log("Replacing the local database...");
    await runCommand("psql", [
      "--set=ON_ERROR_STOP=1",
      "--command=DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
      localConnectionString,
    ]);
    await runCommand("pg_restore", [
      `--dbname=${localConnectionString}`,
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      dumpPath,
    ]);

    console.log("Running pending local migrations...");
    await runCommand("bun", ["infra/scripts/migrate.ts", "up"]);
    console.log("Local database synchronized with production.");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

await syncProductionDatabase();
