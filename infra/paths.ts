import { join } from "path";

export function resolveMigrationsDir(): string {
  return join(process.cwd(), "infra", "migrations");
}

export function resolveTemplatesDir(
  subdir: "prompts" | "messages" | "posts",
): string {
  return join(process.cwd(), "templates", subdir);
}
