#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import {
  CONFIG_LABEL,
  CONFIG_PATH,
  ENVIRONMENT_PATTERN,
  TOKEN_PATTERN,
  validateBaseUrl,
} from "./config.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SOURCE_BYTES = 1_048_576;

const usage = `Usage:
  publish.mjs <file.html> [--title <title>] [--public | --private]
              [--id <artifact-id>] [--environment <name>] [--dry-run]

Credentials and endpoints are loaded exclusively from
${CONFIG_LABEL}, which login.mjs writes.
`;

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

function valueAfter(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parseArguments(argv) {
  const result = {
    file: undefined,
    title: undefined,
    visibility: "private",
    artifactId: undefined,
    environment: undefined,
    dryRun: false,
  };
  let selectedVisibility;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--title") {
      result.title = valueAfter(argv, index, argument);
      index += 1;
    } else if (argument === "--id") {
      result.artifactId = valueAfter(argv, index, argument);
      index += 1;
    } else if (argument === "--environment") {
      result.environment = valueAfter(argv, index, argument);
      index += 1;
    } else if (argument === "--public" || argument === "--private") {
      const visibility = argument.slice(2);
      if (selectedVisibility && selectedVisibility !== visibility) {
        throw new Error("Choose either --public or --private, not both.");
      }
      selectedVisibility = visibility;
      result.visibility = visibility;
    } else if (argument === "--dry-run") {
      result.dryRun = true;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (result.file) {
      throw new Error(`Unexpected argument: ${argument}`);
    } else {
      result.file = argument;
    }
  }

  return result;
}

async function readPublicationTarget(requestedEnvironment, requireToken) {
  const configStat = await stat(CONFIG_PATH);
  if ((configStat.mode & 0o077) !== 0) {
    throw new Error("config.json must be private. Set its permissions to 600.");
  }

  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch {
    throw new Error("config.json is not valid JSON.");
  }
  if (config?.version !== 1 || !config.environments) {
    throw new Error("config.json has an unsupported structure.");
  }

  const environment = requestedEnvironment || config.defaultEnvironment;
  if (!environment || !ENVIRONMENT_PATTERN.test(environment)) {
    throw new Error("No valid publication environment is selected.");
  }
  const target = config.environments[environment];
  if (!target) {
    throw new Error(`Environment ${environment} is not configured.`);
  }
  if (typeof target.baseUrl !== "string") {
    throw new Error(`Environment ${environment} has no valid base URL.`);
  }
  if (
    requireToken &&
    (typeof target.artifactToken !== "string" ||
      !TOKEN_PATTERN.test(target.artifactToken))
  ) {
    throw new Error(
      `Environment ${environment} has no valid upload credential.`,
    );
  }

  return {
    environment,
    baseUrl: validateBaseUrl(target.baseUrl),
    token: target.artifactToken,
  };
}

async function readArtifactSource(fileArgument) {
  if (!fileArgument) throw new Error("Provide an HTML file.");
  const file = resolve(fileArgument);
  if (extname(file).toLowerCase() !== ".html") {
    throw new Error("The artifact source must be an .html file.");
  }
  const fileStat = await stat(file);
  if (!fileStat.isFile())
    throw new Error("The artifact source must be a file.");
  if (fileStat.size > MAX_SOURCE_BYTES) {
    throw new Error("The artifact source must be at most 1 MiB.");
  }
  const html = await readFile(file, "utf8");
  if (!html.trim()) throw new Error("The artifact source cannot be empty.");
  return { file, html, bytes: Buffer.byteLength(html, "utf8") };
}

function deriveTitle(file) {
  return basename(file, extname(file))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function validateTitle(value) {
  const title = value.trim();
  if (!title || title.length > 160) {
    throw new Error("The title must contain between 1 and 160 characters.");
  }
  return title;
}

function formatFailure(status, payload) {
  const lines = [`Publication failed with HTTP ${status}.`];
  const message = payload?.message || payload?.error;
  if (typeof message === "string") lines.push(message);
  const violations = payload?.details?.violations;
  if (Array.isArray(violations)) {
    for (const violation of violations) {
      const code =
        typeof violation?.code === "string" ? violation.code : "invalid_html";
      const detail =
        typeof violation?.message === "string"
          ? violation.message
          : "Artifact HTML was rejected.";
      lines.push(`- ${code}: ${detail}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  const source = await readArtifactSource(options.file);
  const title = validateTitle(options.title || deriveTitle(source.file));
  if (options.artifactId && !UUID_PATTERN.test(options.artifactId)) {
    throw new Error("--id must be a valid artifact UUID.");
  }
  const target = await readPublicationTarget(
    options.environment,
    !options.dryRun,
  );
  const path = options.artifactId
    ? `/api/v1/artifacts/${encodeURIComponent(options.artifactId)}`
    : "/api/v1/artifacts";
  const method = options.artifactId ? "PUT" : "POST";
  const endpoint = new URL(path, target.baseUrl);

  if (options.dryRun) {
    process.stdout.write(
      `${[
        `Dry run: ${method} ${endpoint.href}`,
        `Environment: ${target.environment}`,
        `Title: ${title}`,
        `Visibility: ${options.visibility}`,
        `Source: ${source.file} (${source.bytes} bytes)`,
      ].join("\n")}\n`,
    );
    return;
  }

  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${target.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      html: source.html,
      visibility: options.visibility,
    }),
  });

  const responseText = await response.text();
  let payload;
  try {
    payload = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    payload = undefined;
  }
  if (!response.ok) throw new Error(formatFailure(response.status, payload));
  if (!payload?.artifact?.id || !payload?.url) {
    throw new Error("The server returned an invalid publication response.");
  }

  const action = options.artifactId ? "Updated" : "Published";
  process.stdout.write(
    `${action} ${payload.artifact.visibility} artifact v${payload.artifact.version}: ${payload.url}\nArtifact ID: ${payload.artifact.id}\n`,
  );
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : "Artifact publication failed.");
}
