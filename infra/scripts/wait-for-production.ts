import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { loadModeEnv } from "../../plugins/env";
import { StatusResponseDTO } from "../../src/modules/system/entities/dtos/StatusDTO";
import { normalizeApiResponse } from "../../src/shared/client/utils/ApiResponseParser";

const root = resolve(import.meta.dirname, "..", "..");
const defaultProductionUrl = "https://the-chatbot.irwinarruda.com";
const pollIntervalMilliseconds = 5_000;

loadModeEnv("production", root);

function currentCommitSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function expectedCommitSha(): string {
  const requestedCommit = process.argv[2]?.trim();
  if (requestedCommit) {
    return requestedCommit;
  }
  return currentCommitSha();
}

function deploymentTimeoutMilliseconds(): number {
  const rawTimeout = process.env.PRODUCTION_DEPLOY_TIMEOUT_SECONDS ?? "900";
  const timeoutSeconds = Number.parseInt(rawTimeout, 10);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error(
      "PRODUCTION_DEPLOY_TIMEOUT_SECONDS must be a positive integer",
    );
  }
  return timeoutSeconds * 1_000;
}

function productionUrl(): URL {
  const rawUrl = process.env.PRODUCTION_URL ?? defaultProductionUrl;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("PRODUCTION_URL must use HTTPS");
  }
  return url;
}

function pause(): Promise<void> {
  return new Promise((resolvePause) => {
    setTimeout(resolvePause, pollIntervalMilliseconds);
  });
}

async function readDeployedCommit(endpoint: URL): Promise<string> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`status endpoint returned HTTP ${response.status}`);
  }
  const status = StatusResponseDTO.parse(
    normalizeApiResponse(await response.json()),
  );
  return status.deployment.commitSha;
}

async function waitForProduction(): Promise<void> {
  const expected = expectedCommitSha();
  const endpoint = new URL("/api/v1/status", productionUrl());
  endpoint.searchParams.set("expected", expected);
  const deadline = Date.now() + deploymentTimeoutMilliseconds();
  let lastMessage = "";
  console.log(`Waiting for production commit ${expected.slice(0, 12)}...`);
  while (Date.now() < deadline) {
    let message = "";
    try {
      const deployed = await readDeployedCommit(endpoint);
      if (deployed === expected) {
        console.log(`Production is running commit ${expected.slice(0, 12)}.`);
        return;
      }
      message = `Production is still running ${deployed.slice(0, 12)}.`;
    } catch (error) {
      if (error instanceof Error) {
        message = `Production is not ready: ${error.message}.`;
      } else {
        message = "Production is not ready.";
      }
    }
    if (message !== lastMessage) {
      console.log(message);
      lastMessage = message;
    }
    await pause();
  }
  throw new Error(
    `Timed out waiting for production commit ${expected.slice(0, 12)}`,
  );
}

await waitForProduction();
