import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";

export class ChatTemplateLoader {
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly directory: string,
    private readonly missingFileLabel: string,
  ) {}

  load(
    fileName: string,
    data: Record<string, string | undefined> = {},
  ): string {
    const filePath = join(this.directory, fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException(
        `${this.missingFileLabel} not found: ${filePath}`,
      );
    }
    let text = this.cache.get(filePath);
    if (!text) {
      text = readFileSync(filePath, "utf-8");
      this.cache.set(filePath, text);
    }
    if (Object.keys(data).length === 0) return text;
    return text.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key: string) => {
      return data[key] ?? match;
    });
  }
}
