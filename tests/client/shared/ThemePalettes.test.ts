import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../src/client/shared/styles/tailwind.css",
  ),
  "utf8",
);

function paletteBlocks() {
  const blocks = [...css.matchAll(/^ {2}(\S[^{\n]*) \{\n([\s\S]*?)\n {2}\}/gm)];
  return blocks
    .map(([, selector, body]) => ({
      selector,
      roles: [...body.matchAll(/^\s+(--palette-[a-z-]+):/gm)].map(
        ([, role]) => role,
      ),
    }))
    .filter((block) => block.roles.length > 0);
}

describe("Theme palettes", () => {
  test("Terminal and Favo, dark and light, each define every color role", () => {
    const blocks = paletteBlocks();
    const [terminalDark] = blocks;

    expect(blocks.map((block) => block.selector)).toEqual([
      ":root",
      '[data-theme="light"]',
      '[data-palette="favo"]',
      '[data-palette="favo"][data-theme="light"]',
    ]);
    expect(terminalDark.roles).toHaveLength(21);
    for (const block of blocks) {
      expect([...block.roles].sort()).toEqual([...terminalDark.roles].sort());
    }
  });
});
