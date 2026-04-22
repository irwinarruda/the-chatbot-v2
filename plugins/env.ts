import { config } from "dotenv";
import path from "path";

export const validModes = [
  "development",
  "test",
  "preview",
  "production",
] as const;

export type Mode = (typeof validModes)[number];

export function resolveMode(mode: string): Mode {
  if (!validModes.includes(mode as Mode)) {
    throw new Error(
      `Invalid mode: "${mode}". Expected one of: ${validModes.join(", ")}`,
    );
  }
  return mode as Mode;
}

export function loadModeEnv(mode: string, envDir = process.cwd()): Mode {
  const resolvedMode = resolveMode(mode);
  config({ path: path.join(envDir, ".env") });
  config({
    path: path.join(envDir, `.env.${resolvedMode}`),
    override: true,
  });
  return resolvedMode;
}
