#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import {
  CONFIG_LABEL,
  CONFIG_PATH,
  ENVIRONMENT_PATTERN,
  TOKEN_PATTERN,
  validateBaseUrl,
} from "./config.mjs";

const run = promisify(execFile);

const CLIPBOARD_COMMANDS = {
  darwin: [["pbpaste", []]],
  win32: [["powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"]]],
  linux: [
    ["wl-paste", ["--no-newline"]],
    ["xclip", ["-selection", "clipboard", "-o"]],
    ["xsel", ["--clipboard", "--output"]],
  ],
};

const usage = `Usage:
  login.mjs

Reads the configuration copied from The Chatbot's Artifacts page out of the
clipboard and saves it, private, at ${CONFIG_LABEL}.
Environments already saved there are kept. The token is never printed.
`;

async function readClipboard() {
  for (const [command, args] of CLIPBOARD_COMMANDS[process.platform] ?? []) {
    const result = await run(command, args).catch(() => undefined);
    if (result) return result.stdout;
  }
  throw new Error(
    `Could not read the clipboard on this system. Save the configuration at ${CONFIG_LABEL} by hand, with mode 600.`,
  );
}

function readCopiedConfig(text) {
  try {
    const config = JSON.parse(text);
    const names = Object.keys(config.environments);
    if (config.version !== 1 || names.length === 0) throw new Error();
    const environments = {};
    for (const name of names) {
      const target = config.environments[name];
      if (
        !ENVIRONMENT_PATTERN.test(name) ||
        !TOKEN_PATTERN.test(target.artifactToken)
      ) {
        throw new Error();
      }
      environments[name] = {
        baseUrl: validateBaseUrl(target.baseUrl).origin,
        artifactToken: target.artifactToken,
      };
    }
    const defaultEnvironment = names.includes(config.defaultEnvironment)
      ? config.defaultEnvironment
      : names[0];
    return { defaultEnvironment, environments };
  } catch {
    throw new Error(
      "The clipboard does not hold a configuration from The Chatbot's Artifacts page. Copy it there and run this again.",
    );
  }
}

async function readSavedConfig() {
  let text;
  try {
    text = await readFile(CONFIG_PATH, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const config = JSON.parse(text);
    if (config.version !== 1 || typeof config.environments !== "object") {
      throw new Error();
    }
    return config;
  } catch {
    throw new Error(
      `${CONFIG_LABEL} exists but is not a valid configuration. Fix or delete it, then run this again.`,
    );
  }
}

async function main() {
  if (process.argv.length > 2) {
    process.stdout.write(usage);
    return;
  }

  const copied = readCopiedConfig(await readClipboard());
  const saved = await readSavedConfig();
  const config = {
    version: 1,
    defaultEnvironment: saved?.defaultEnvironment ?? copied.defaultEnvironment,
    environments: { ...saved?.environments, ...copied.environments },
  };

  const temporaryPath = `${CONFIG_PATH}.${process.pid}.tmp`;
  await mkdir(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryPath, CONFIG_PATH);

  const lines = Object.entries(copied.environments).map(
    ([name, target]) => `Saved environment ${name} for ${target.baseUrl}.`,
  );
  lines.push(`Default environment: ${config.defaultEnvironment}.`);
  lines.push(`Configuration: ${CONFIG_LABEL}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : "Login failed."}\n`,
  );
  process.exitCode = 1;
}
