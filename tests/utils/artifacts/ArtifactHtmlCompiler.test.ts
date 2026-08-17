import { JSDOM } from "jsdom";
import { describe, expect, test } from "vitest";
import { compileArtifactHtml } from "~/modules/artifacts/utils/ArtifactHtmlCompiler";
import { ArtifactValidationException } from "~/modules/artifacts/utils/ArtifactValidationException";

describe("compileArtifactHtml", () => {
  test("keeps expressive static HTML, SVG, CSS animation, and highlighted code", async () => {
    const source = `<!doctype html>
      <html>
        <head>
          <style>
            :root { --card: #131a23; }
            .card { animation: arrive 300ms ease-out; background: var(--card); }
            @keyframes arrive { from { opacity: 0; } to { opacity: 1; } }
          </style>
        </head>
        <body>
          <main class="card">
            <svg viewBox="0 0 20 20" aria-label="status">
              <defs><linearGradient id="paint"><stop stop-color="#50dfaa" /></linearGradient></defs>
              <circle cx="10" cy="10" r="8" fill="url(#paint)" />
            </svg>
            <details><summary>Code</summary><pre><code class="language-ts">const value = 1;</code></pre></details>
          </main>
        </body>
      </html>`;

    const compiled = await compileArtifactHtml(source, "Static plan");

    expect(compiled.rendererVersion).toBe("static-html-v1");
    expect(compiled.html).toContain("script-src 'none'");
    expect(compiled.html).toContain('class="shiki github-dark"');
    expect(compiled.html).toContain('<linearGradient id="paint">');
    expect(compiled.html).toContain("@keyframes arrive");
    expect(compiled.html).not.toContain("<script");
  });

  test("rejects executable markup and external assets", async () => {
    const source = `
      <main onclick="alert(1)">
        <script>alert(1)</script>
        <img src="https://attacker.example/pixel.png">
      </main>`;

    const error = await compileArtifactHtml(source, "Unsafe").catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ArtifactValidationException);
    expect(error.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "event_handler" }),
        expect.objectContaining({ code: "blocked_element" }),
        expect.objectContaining({ code: "external_asset" }),
      ]),
    );
  });

  test("rejects CSS imports and URL fetches", async () => {
    await expect(
      compileArtifactHtml(
        `<style>@import "https://attacker.example/a.css"; .x { background: url(https://attacker.example/x); }</style><main class="x">x</main>`,
        "Unsafe CSS",
      ),
    ).rejects.toBeInstanceOf(ArtifactValidationException);
  });

  test("escapes style end tags when CSS strings contain HTML-like text", async () => {
    const compiled = await compileArtifactHtml(
      `<style>.label::after { content: "<\\/style><script>bad()<\\/script>"; }</style><span class="label">Safe</span>`,
      "Escaped",
    );

    expect(compiled.html).not.toContain("</style><script>bad()");
    expect(
      new JSDOM(compiled.html).window.document.querySelector("script"),
    ).toBeNull();
  });

  test("rejects syntax highlighting work before invoking Shiki", async () => {
    const error = await compileArtifactHtml(
      `<pre><code class="language-ts">${"a".repeat(10_001)}</code></pre>`,
      "Large code",
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(ArtifactValidationException);
    expect(error.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "code_block_too_large" }),
      ]),
    );
  });

  test("caps aggregate syntax highlighting work before invoking Shiki", async () => {
    const codeBlock = `<pre><code class="language-ts">${"a".repeat(7_000)}</code></pre>`;
    const error = await compileArtifactHtml(
      codeBlock.repeat(3),
      "Large code collection",
    ).catch((caught) => caught);

    expect(error).toBeInstanceOf(ArtifactValidationException);
    expect(error.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "highlighted_code_too_large" }),
      ]),
    );
  });

  test("preserves a valid source document language", async () => {
    const compiled = await compileArtifactHtml(
      '<!doctype html><html lang="pt-br"><body><main>Plano</main></body></html>',
      "Plano",
    );

    expect(compiled.html).toContain('<html lang="pt-BR">');
  });
});
