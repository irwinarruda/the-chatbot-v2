import { NotFoundException } from "@infra/exceptions";
import { resolveTemplatesDir } from "@infra/paths";
import { existsSync, readFileSync } from "fs";
import { Marked, Renderer } from "marked";
import { join } from "path";
import type { Locale } from "~/i18n";

const postsRoot = resolveTemplatesDir("posts");
const cache = new Map<string, string>();

const renderer = new Renderer();
renderer.link = ({ href, text }) => {
  return `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
};

const marked = new Marked({ renderer });

export class PostLoader {
  static getPost(name: string, locale: Locale): string {
    const fileName = `${name}.${locale}.md`;
    const cached = cache.get(fileName);
    if (cached) return cached;

    const filePath = join(postsRoot, fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Post file not found: ${filePath}`);
    }
    const markdown = readFileSync(filePath, "utf-8");
    const html = marked.parse(markdown) as string;
    cache.set(fileName, html);
    return html;
  }
}
