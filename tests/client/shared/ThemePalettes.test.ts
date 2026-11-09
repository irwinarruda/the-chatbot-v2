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

const Statuses = ["success", "warning", "danger", "info"];

function paletteBlocks() {
  const blocks = [...css.matchAll(/^ {2}(\S[^{\n]*) \{\n([\s\S]*?)\n {2}\}/gm)];
  return blocks
    .map(([, selector, body]) => ({
      selector,
      roles: [...body.matchAll(/^\s+(--palette-[a-z-]+):/gm)].map(
        ([, role]) => role,
      ),
      colors: Object.fromEntries(
        [...body.matchAll(/^\s+--palette-([a-z-]+): (#[0-9a-f]{6});/gm)].map(
          ([, role, hex]) => [role, hex],
        ),
      ),
    }))
    .filter((block) => block.roles.length > 0);
}

function tokensReading(role: string) {
  return [
    ...css.matchAll(new RegExp(`^\\s+(--[a-z0-9-]+): var\\(${role}\\);`, "gm")),
  ].map(([, token]) => token);
}

function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    if (channel <= 0.04045) return channel / 12.92;
    return ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
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
    expect(barroSlate.roles).toHaveLength(35);
    for (const block of blocks) {
      expect([...block.roles].sort()).toEqual([...barroSlate.roles].sort());
      expect(Object.keys(block.colors)).toHaveLength(35);
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

  test("inputs and cards share the quiet border, and an input's fill sets it apart", () => {
    expect(tokensReading("--palette-border")).toEqual([
      "--border",
      "--input",
      "--sidebar-border",
    ]);
  });

  test("reading text is the theme's own tone", () => {
    expect(tokensReading("--palette-fg-reading")).toEqual(["--fg-reading"]);
  });

  test("status and brand text reads on its soft background in every palette", () => {
    for (const { selector, colors } of paletteBlocks()) {
      for (const status of Statuses) {
        expect(
          contrast(colors[status], colors[`${status}-soft`]),
          `${status} on its soft background in ${selector}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(colors["accent-text"], colors["accent-soft"]),
        `brand text on its soft background in ${selector}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("text on a primary button reads in every palette", () => {
    for (const { selector, colors } of paletteBlocks()) {
      for (const fill of ["fill", "fill-hover"]) {
        expect(
          contrast(colors["on-fill"], colors[fill]),
          `text on ${fill} in ${selector}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
