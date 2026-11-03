import { join } from "path";

export class Paths {
  static migrationsDir(): string {
    return join(process.cwd(), "infra", "migrations");
  }

  static templatesDir(subdir: "prompts" | "messages" | "posts"): string {
    return join(process.cwd(), "templates", subdir);
  }
}
