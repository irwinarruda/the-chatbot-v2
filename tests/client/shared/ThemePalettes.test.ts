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

function tokensReading(role: string) {
  return [
    ...css.matchAll(new RegExp(`^\\s+(--[a-z0-9-]+): var\\(${role}\\);`, "gm")),
  ].map(([, token]) => token);
}

describe("Theme palettes", () => {
  test("Barro and Favo, dark and light, each define every color role", () => {
    const blocks = paletteBlocks();
    const [barroSlate] = blocks;

    expect(blocks.map((block) => block.selector)).toEqual([
      ":root",
      '[data-theme="light"]',
      '[data-palette="favo"]',
      '[data-palette="favo"][data-theme="light"]',
    ]);
    expect(barroSlate.roles).toHaveLength(25);
    for (const block of blocks) {
      expect([...block.roles].sort()).toEqual([...barroSlate.roles].sort());
    }
  });

  test("errors use the danger color and leave regex to code", () => {
    expect(tokensReading("--palette-danger")).toEqual(["--destructive"]);
    expect(tokensReading("--palette-regex")).toEqual(["--color-syntax-regex"]);
  });

  test("success and info text use each palette's status colors, not its code colors", () => {
    expect(tokensReading("--palette-success")).toEqual(["--success"]);
    expect(tokensReading("--palette-info")).toEqual(["--info"]);
  });

  test("text on primary buttons comes from each palette's onFill", () => {
    expect(tokensReading("--palette-on-fill")).toEqual([
      "--primary-foreground",
      "--sidebar-primary-foreground",
    ]);
  });
});
