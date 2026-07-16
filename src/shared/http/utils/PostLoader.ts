import { existsSync, readFileSync } from "fs";
import { Marked, Renderer } from "marked";
import { join } from "path";
import { Paths } from "~/infra/paths";
import type { PrefsDTO } from "~/shared/entities/dtos/PrefsDTO";
import { NotFoundException } from "~/shared/errors/ApplicationErrors";

type Locale = PrefsDTO["locale"];

export class PostLoader {
  private static cache = new Map<string, string>();
  private static marked = new Marked({
    renderer: PostLoader.createRenderer(),
  });

  private static createRenderer(): Renderer {
    const renderer = new Renderer();
    renderer.link = ({ href, text }) => {
      return `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
    };
    return renderer;
  }

  static getPost(name: string, locale: Locale): string {
    const fileName = `${name}.${locale}.md`;
    const cached = PostLoader.cache.get(fileName);
    if (cached) return cached;

    const filePath = join(Paths.templatesDir("posts"), fileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException(`Post file not found: ${filePath}`);
    }
    const markdown = readFileSync(filePath, "utf-8");
    const html = PostLoader.marked.parse(markdown) as string;
    PostLoader.cache.set(fileName, html);
    return html;
  }
}
