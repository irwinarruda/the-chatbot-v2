import { readdir } from "node:fs/promises";
import { parse, resolve } from "node:path";
import { z } from "zod";
import { loadModeEnv } from "../../plugins/env";

const root = resolve(import.meta.dirname, "..", "..");
const defaultProductionUrl = "https://the-chatbot.irwinarruda.com";
const PendingMigrations = z.array(z.string().min(1));

loadModeEnv("production", root);

function productionUrl(): URL {
  const rawUrl = process.env.PRODUCTION_URL ?? defaultProductionUrl;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("PRODUCTION_URL must use HTTPS");
  }
  return url;
}

async function listPendingMigrations(endpoint: URL): Promise<string[]> {
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`migration endpoint returned HTTP ${response.status}`);
  }
  return PendingMigrations.parse(await response.json());
}

function printPendingMigrations(migrations: string[]): void {
  if (migrations.length === 0) {
    console.log("Production migrations are up to date.");
    return;
  }
  console.log("Pending production migrations:");
  for (const migration of migrations) {
    console.log(`- ${migration}`);
  }
}

async function assertMigrationsExistLocally(
  pendingMigrations: string[],
): Promise<void> {
  const migrationDirectory = resolve(root, "infra", "migrations");
  const migrationFiles = await readdir(migrationDirectory);
  const localMigrations = new Set(
    migrationFiles.map((file) => parse(file).name),
  );
  const missingMigrations = pendingMigrations.filter(
    (migration) => !localMigrations.has(migration),
  );
  if (missingMigrations.length > 0) {
    throw new Error(
      `Production reported migrations missing locally: ${missingMigrations.join(", ")}`,
    );
  }
}

async function runPendingMigrations(endpoint: URL): Promise<void> {
  const password = process.env.AUTH_HASH_PASSWORD;
  if (!password) {
    throw new Error("AUTH_HASH_PASSWORD is missing from .env.production");
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "x-migration-password": password },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`migration endpoint returned HTTP ${response.status}`);
  }
}

async function manageProductionMigrations(): Promise<void> {
  const command = process.argv[2] ?? "status";
  if (command !== "status" && command !== "up") {
    throw new Error("Expected migration command: status or up");
  }
  const endpoint = new URL("/api/v1/migration", productionUrl());
  const pendingMigrations = await listPendingMigrations(endpoint);
  printPendingMigrations(pendingMigrations);
  if (command === "status" || pendingMigrations.length === 0) {
    return;
  }
  await assertMigrationsExistLocally(pendingMigrations);
  await runPendingMigrations(endpoint);
  const remainingMigrations = await listPendingMigrations(endpoint);
  if (remainingMigrations.length > 0) {
    throw new Error(
      `Production still has pending migrations: ${remainingMigrations.join(", ")}`,
    );
  }
  console.log("Production migrations applied and verified.");
}

await manageProductionMigrations();
