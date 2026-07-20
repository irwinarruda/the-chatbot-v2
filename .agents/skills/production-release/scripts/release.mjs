#!/usr/bin/env bun

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  lstat,
  readdir,
  readFile,
  readlink,
  writeFile,
} from "node:fs/promises";
import { parse as parsePath, resolve } from "node:path";
import { parse as parseEnv } from "dotenv";
import { z } from "zod";
import { createProductionWebAuthCookie } from "./create-browser-auth-cookie.mjs";

const root = resolve(import.meta.dirname, "..", "..", "..", "..");
const defaultProductionUrl = "https://the-chatbot.irwinarruda.com";
const migrationDirectory = "infra/migrations";
const releaseClasses = new Set(["code-only", "database-change"]);
const PendingMigrations = z.array(z.string().min(1));
const [command = "help", ...commandArguments] = process.argv.slice(2);

function runGit(argumentsList, encoding = "utf8") {
  return execFileSync("git", argumentsList, {
    cwd: root,
    encoding,
    maxBuffer: 100 * 1024 * 1024,
  });
}

function splitNull(buffer) {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter((value) => value.length > 0);
}

function optionValue(name) {
  const index = commandArguments.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = commandArguments[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function hasFlag(name) {
  return commandArguments.includes(name);
}

function positionalArguments(valueOptions = []) {
  const values = [];
  const optionsWithValues = new Set(valueOptions);
  for (let index = 0; index < commandArguments.length; index += 1) {
    const argument = commandArguments[index];
    if (optionsWithValues.has(argument)) {
      index += 1;
      continue;
    }
    if (!argument.startsWith("--")) {
      values.push(argument);
    }
  }
  return values;
}

function displayCommand(program, argumentsList) {
  return [program, ...argumentsList].join(" ");
}

async function runCommand(program, argumentsList) {
  console.log(`$ ${displayCommand(program, argumentsList)}`);
  const child = spawn(program, argumentsList, {
    cwd: root,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    process.stderr.write(chunk);
  });
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", resolveExit);
  });
  if (exitCode !== 0) {
    throw new Error(`${program} exited with code ${exitCode}`);
  }
  return { stdout, stderr };
}

async function runVercel(argumentsList) {
  return runCommand("bunx", ["vercel@latest", ...argumentsList]);
}

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Required file is missing: ${path}`);
  }
}

async function productionValues() {
  const basePath = resolve(root, ".env");
  const productionPath = resolve(root, ".env.production");
  await requireFile(basePath);
  await requireFile(productionPath);
  const baseValues = parseEnv(await readFile(basePath));
  const productionOverrides = parseEnv(await readFile(productionPath));
  return { ...baseValues, ...productionOverrides };
}

function requireSecret(values, key) {
  const value = values[key]?.trim();
  if (!value) {
    throw new Error(`${key} is missing from .env.production`);
  }
  return value;
}

function productionUrl(values) {
  const rawUrl = values.PRODUCTION_URL?.trim() || defaultProductionUrl;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("PRODUCTION_URL must use HTTPS");
  }
  return url;
}

async function doctor(options = {}) {
  if (process.cwd() !== root) {
    throw new Error(`Run this helper from the repository root: ${root}`);
  }
  runGit(["rev-parse", "--is-inside-work-tree"]);
  await requireFile(resolve(root, ".vercel", "project.json"));
  const values = await productionValues();
  const auth = await createProductionWebAuthCookie({ root, values });
  auth.cookie.value = "";
  if (options.requireAutomationBypass) {
    requireSecret(values, "VERCEL_AUTOMATION_BYPASS_SECRET");
  }
  console.log("Repository, Vercel link, and production app auth are valid.");
  if (values.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()) {
    console.log("Vercel automation bypass is configured.");
  } else {
    console.log(
      "Vercel automation bypass is not configured; protected candidate browser testing will stop.",
    );
  }
  return values;
}

function changedFiles() {
  runGit(["rev-parse", "--verify", "refs/remotes/origin/main"]);
  const branchFiles = splitNull(
    runGit(
      ["diff", "--name-only", "-z", "refs/remotes/origin/main", "HEAD"],
      "buffer",
    ),
  );
  const worktreeFiles = splitNull(
    runGit(["diff", "--name-only", "-z", "HEAD"], "buffer"),
  );
  const untrackedFiles = splitNull(
    runGit(["ls-files", "--others", "--exclude-standard", "-z"], "buffer"),
  );
  return [
    ...new Set([...branchFiles, ...worktreeFiles, ...untrackedFiles]),
  ].sort();
}

function migrationPaths(files) {
  return files.filter(
    (file) =>
      file === migrationDirectory || file.startsWith(`${migrationDirectory}/`),
  );
}

async function sourceFingerprint() {
  const hash = createHash("sha256");
  hash.update(runGit(["rev-parse", "HEAD"]));
  hash.update(runGit(["diff", "--binary", "HEAD"], "buffer"));
  const untrackedFiles = splitNull(
    runGit(["ls-files", "--others", "--exclude-standard", "-z"], "buffer"),
  ).sort();
  for (const file of untrackedFiles) {
    const path = resolve(root, file);
    const fileStat = await lstat(path);
    hash.update(file);
    hash.update(String(fileStat.mode));
    if (fileStat.isSymbolicLink()) {
      hash.update(await readlink(path));
      continue;
    }
    if (fileStat.isFile()) {
      hash.update(await readFile(path));
    }
  }
  return hash.digest("hex");
}

async function inspectSource() {
  const files = changedFiles();
  const scope = {
    branch: runGit(["branch", "--show-current"]).trim() || "detached",
    headSha: runGit(["rev-parse", "HEAD"]).trim(),
    baselineSha: runGit(["rev-parse", "refs/remotes/origin/main"]).trim(),
    fingerprint: await sourceFingerprint(),
    files,
    migrations: migrationPaths(files),
  };
  console.log(`Branch: ${scope.branch}`);
  console.log(`HEAD: ${scope.headSha}`);
  console.log(`Local origin/main baseline: ${scope.baselineSha}`);
  console.log(`Source fingerprint: ${scope.fingerprint}`);
  console.log(`Changed files: ${scope.files.length}`);
  for (const file of scope.files) {
    console.log(`- ${file}`);
  }
  console.log(`Detected migration paths: ${scope.migrations.length}`);
  for (const migration of scope.migrations) {
    console.log(`- ${migration}`);
  }
  return scope;
}

function requiredReleaseClass() {
  const releaseClass = optionValue("--class");
  if (!releaseClass || !releaseClasses.has(releaseClass)) {
    throw new Error("--class must be code-only or database-change");
  }
  return releaseClass;
}

function assertReleaseClass(scope, releaseClass) {
  if (releaseClass === "code-only" && scope.migrations.length > 0) {
    throw new Error(
      "code-only is blocked because branch or working-tree migration changes were detected",
    );
  }
  if (releaseClass === "database-change" && !hasFlag("--database-ready")) {
    throw new Error(
      "database-change requires --database-ready after the database release gate is complete",
    );
  }
}

async function runReleaseChecks() {
  await runCommand("bun", ["run", "check"]);
  await runCommand("bun", ["run", "typecheck"]);
  await runCommand("bun", ["run", "test"]);
}

function deploymentUrlFromOutput(output) {
  const inspected = output.match(
    /^url\s+(https:\/\/[^\s]+\.vercel\.app)\s*$/mu,
  );
  if (inspected) {
    return new URL(inspected[1]).href;
  }
  const matches = [...output.matchAll(/https:\/\/[^\s"'<>]+\.vercel\.app/gmu)];
  if (matches.length === 0) {
    throw new Error("Vercel output did not contain a deployment URL");
  }
  return new URL(matches[matches.length - 1][0]).href;
}

async function inspectDeployment(url, wait = false) {
  const argumentsList = ["inspect", url, "--no-color"];
  if (wait) {
    argumentsList.push("--wait", "--timeout", "10m");
  }
  const result = await runVercel(argumentsList);
  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.includes("Ready")) {
    throw new Error(`Deployment is not Ready: ${url}`);
  }
  return deploymentUrlFromOutput(output);
}

function statePath() {
  const gitDirectory = runGit(["rev-parse", "--git-dir"]).trim();
  return resolve(root, gitDirectory, "production-release-candidate.json");
}

async function saveState(state) {
  await writeFile(statePath(), `${JSON.stringify(state, undefined, 2)}\n`, {
    mode: 0o600,
  });
}

async function loadState() {
  const path = statePath();
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    throw new Error(
      "No saved production candidate exists; run the deploy command first",
    );
  }
}

async function assertSourceStillMatches(state) {
  const currentFingerprint = await sourceFingerprint();
  if (currentFingerprint !== state.sourceFingerprint) {
    throw new Error(
      "Local source changed after candidate deployment; redeploy before promotion",
    );
  }
}

function migrationHeaders(values, targetUrl) {
  const headers = { Accept: "application/json" };
  const canonical = productionUrl(values);
  if (targetUrl.host !== canonical.host) {
    headers["x-vercel-protection-bypass"] = requireSecret(
      values,
      "VERCEL_AUTOMATION_BYPASS_SECRET",
    );
  }
  return headers;
}

async function pendingMigrations(targetUrl, values) {
  const endpoint = new URL("/api/v1/migration", targetUrl);
  const response = await fetch(endpoint, {
    headers: migrationHeaders(values, targetUrl),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`migration endpoint returned HTTP ${response.status}`);
  }
  return PendingMigrations.parse(await response.json());
}

function printPendingMigrations(migrations) {
  if (migrations.length === 0) {
    console.log("Production migrations are up to date.");
    return;
  }
  console.log("Pending production migrations:");
  for (const migration of migrations) {
    console.log(`- ${migration}`);
  }
}

async function assertMigrationsExistLocally(migrations) {
  const files = await readdir(resolve(root, migrationDirectory));
  const localMigrations = new Set(files.map((file) => parsePath(file).name));
  const missing = migrations.filter(
    (migration) => !localMigrations.has(migration),
  );
  if (missing.length > 0) {
    throw new Error(
      `Production reported migrations missing locally: ${missing.join(", ")}`,
    );
  }
}

async function applyMigrations(targetUrl, values) {
  const endpoint = new URL("/api/v1/migration", targetUrl);
  const headers = migrationHeaders(values, targetUrl);
  headers["x-migration-password"] = requireSecret(values, "AUTH_HASH_PASSWORD");
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(90_000),
  });
  headers["x-migration-password"] = "";
  if (!response.ok) {
    throw new Error(`migration endpoint returned HTTP ${response.status}`);
  }
}

async function deploy() {
  await doctor({ requireAutomationBypass: true });
  const releaseClass = requiredReleaseClass();
  const initialScope = await inspectSource();
  assertReleaseClass(initialScope, releaseClass);
  await runReleaseChecks();
  const finalScope = await inspectSource();
  assertReleaseClass(finalScope, releaseClass);
  const values = await productionValues();
  const previousProductionUrl = await inspectDeployment(
    productionUrl(values).href,
  );
  const fingerprintBeforeDeploy = finalScope.fingerprint;
  const result = await runVercel([
    "deploy",
    "--prod",
    "--skip-domain",
    "--yes",
    "--no-color",
  ]);
  const deploymentUrl = deploymentUrlFromOutput(
    `${result.stdout}\n${result.stderr}`,
  );
  const readyDeploymentUrl = await inspectDeployment(deploymentUrl, true);
  const fingerprintAfterDeploy = await sourceFingerprint();
  if (fingerprintAfterDeploy !== fingerprintBeforeDeploy) {
    throw new Error(
      "Local source changed while Vercel was uploading; candidate identity is ambiguous and was not saved",
    );
  }
  const state = {
    version: 1,
    deploymentUrl: readyDeploymentUrl,
    previousProductionUrl,
    sourceFingerprint: fingerprintAfterDeploy,
    branch: finalScope.branch,
    headSha: finalScope.headSha,
    baselineSha: finalScope.baselineSha,
    releaseClass,
    migrationPaths: finalScope.migrations,
    deployedAt: new Date().toISOString(),
  };
  await saveState(state);
  console.log(`Candidate saved: ${state.deploymentUrl}`);
  console.log("Production domain was not changed.");
}

async function migrationTarget(state, values) {
  const target = optionValue("--target") || "candidate";
  if (target === "candidate") {
    return new URL(state.deploymentUrl);
  }
  if (target === "production") {
    return productionUrl(values);
  }
  throw new Error("--target must be candidate or production");
}

async function migrations() {
  const [operation] = positionalArguments(["--target"]);
  if (operation !== "status" && operation !== "up") {
    throw new Error("Expected migrations command: status or up");
  }
  const values = await productionValues();
  const target = optionValue("--target") || "candidate";
  const state =
    target === "production" && operation === "status"
      ? undefined
      : await loadState();
  const targetUrl =
    target === "production"
      ? productionUrl(values)
      : await migrationTarget(state, values);
  const pending = await pendingMigrations(targetUrl, values);
  printPendingMigrations(pending);
  if (operation === "status" || pending.length === 0) {
    return;
  }
  if (!state) {
    throw new Error("Migration application requires a saved candidate");
  }
  if (state.releaseClass !== "database-change") {
    throw new Error(
      "Migration application requires a database-change candidate",
    );
  }
  if (!hasFlag("--database-ready")) {
    throw new Error("Migration application requires --database-ready");
  }
  await assertSourceStillMatches(state);
  await assertMigrationsExistLocally(pending);
  await applyMigrations(targetUrl, values);
  const remaining = await pendingMigrations(targetUrl, values);
  if (remaining.length > 0) {
    throw new Error(
      `Production still has pending migrations: ${remaining.join(", ")}`,
    );
  }
  console.log("Production migrations applied and verified.");
}

async function promote() {
  const values = await doctor({ requireAutomationBypass: true });
  const state = await loadState();
  await assertSourceStillMatches(state);
  const [requestedUrl] = positionalArguments();
  if (requestedUrl && new URL(requestedUrl).href !== state.deploymentUrl) {
    throw new Error("Requested URL does not match the saved candidate");
  }
  if (
    state.releaseClass === "database-change" &&
    !hasFlag("--database-ready")
  ) {
    throw new Error("Database-changing promotion requires --database-ready");
  }
  if (state.releaseClass === "code-only") {
    const pending = await pendingMigrations(productionUrl(values), values);
    if (pending.length > 0) {
      printPendingMigrations(pending);
      throw new Error(
        "Code-only promotion is blocked by pending production migrations",
      );
    }
  }
  await inspectDeployment(state.deploymentUrl, true);
  await runVercel([
    "promote",
    state.deploymentUrl,
    "--yes",
    "--timeout",
    "10m",
    "--no-color",
  ]);
  const currentProductionUrl = await inspectDeployment(
    productionUrl(values).href,
    true,
  );
  if (currentProductionUrl !== state.deploymentUrl) {
    throw new Error(
      `Canonical production resolves to ${currentProductionUrl}, not ${state.deploymentUrl}`,
    );
  }
  state.promotedAt = new Date().toISOString();
  await saveState(state);
  console.log(`Promoted exact candidate: ${state.deploymentUrl}`);
}

async function rollback() {
  const values = await productionValues();
  const state = await loadState();
  if (!state.promotedAt) {
    throw new Error("The saved candidate has not been promoted");
  }
  if (
    state.releaseClass === "database-change" &&
    !hasFlag("--database-compatible")
  ) {
    throw new Error(
      "Database-changing rollback requires --database-compatible after proving the previous code supports current production data",
    );
  }
  await runVercel([
    "rollback",
    state.previousProductionUrl,
    "--yes",
    "--timeout",
    "10m",
    "--no-color",
  ]);
  const currentProductionUrl = await inspectDeployment(
    productionUrl(values).href,
    true,
  );
  if (currentProductionUrl !== state.previousProductionUrl) {
    throw new Error(
      `Rollback resolved to ${currentProductionUrl}, not ${state.previousProductionUrl}`,
    );
  }
  state.rolledBackAt = new Date().toISOString();
  await saveState(state);
  console.log(`Rolled back to: ${state.previousProductionUrl}`);
}

async function status() {
  const state = await loadState();
  console.log(JSON.stringify(state, undefined, 2));
  const fingerprint = await sourceFingerprint();
  if (fingerprint === state.sourceFingerprint) {
    console.log("Local source still matches the saved candidate.");
  } else {
    console.log("Local source has changed since candidate deployment.");
  }
  await inspectDeployment(state.deploymentUrl);
}

function help() {
  console.log(`Usage:
  release.mjs doctor
  release.mjs inspect
  release.mjs deploy --class code-only
  release.mjs deploy --class database-change --database-ready
  release.mjs migrations status [--target candidate|production]
  release.mjs migrations up --database-ready [--target candidate|production]
  release.mjs promote [candidate-url] [--database-ready]
  release.mjs rollback [--database-compatible]
  release.mjs status`);
}

async function main() {
  if (command === "doctor") {
    await doctor();
    return;
  }
  if (command === "inspect") {
    await inspectSource();
    return;
  }
  if (command === "deploy") {
    await deploy();
    return;
  }
  if (command === "migrations") {
    await migrations();
    return;
  }
  if (command === "promote") {
    await promote();
    return;
  }
  if (command === "rollback") {
    await rollback();
    return;
  }
  if (command === "status") {
    await status();
    return;
  }
  help();
  if (command !== "help") {
    throw new Error(`Unknown command: ${command}`);
  }
}

try {
  await main();
} catch (error) {
  let message = "Production release failed";
  if (error instanceof Error) {
    message = error.message;
  }
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}
