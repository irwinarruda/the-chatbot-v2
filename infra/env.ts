import { config } from "dotenv";
import path from "path";

const validModes = [
  "local",
  "development",
  "test",
  "preview",
  "production",
] as const;

type Mode = (typeof validModes)[number];

export class Env {
  static load(): void {
    const mode = (process.env.MODE ?? process.env.NODE_ENV) as Mode;
    if (!validModes.includes(mode)) {
      throw new Error(
        `Invalid MODE: "${mode}". Expected one of: ${validModes.join(", ")}`,
      );
    }
    const envDir = process.cwd();
    config({ path: path.join(envDir, ".env") });
    config({ path: path.join(envDir, `.env.${mode}`), override: true });
    process.env.MODE = mode;
  }
}
