import { join } from "path";

export function resolveMigrationsDir(): string {
  return join(process.cwd(), "src", "infra", "migrations");
}

export function resolveTemplatesDir(subdir: "prompts" | "messages"): string {
  return join(process.cwd(), "templates", subdir);
}
