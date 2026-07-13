import { readFileSync } from "fs";
import { globSync } from "tinyglobby";
import { describe, expect, test } from "vitest";

describe("module boundaries", () => {
  test("domain code does not import infrastructure, server, or client code", () => {
    const files = globSync([
      "src/modules/*/domain/**/*.ts",
      "src/shared/domain/**/*.ts",
    ]);
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return (
        source
          .match(
            /from ["']~\/(?:infra|server|shared\/(?:client|http)|modules\/[^/]+\/(?:application|server|client))\//g,
          )
          ?.map(() => file) ?? []
      );
    });

    expect(violations).toEqual([]);
  });

  test("server and application code does not import client implementation", () => {
    const files = globSync([
      "src/shared/http/**/*.ts",
      "src/modules/*/application/**/*.ts",
      "src/modules/*/server/**/*.ts",
    ]);
    const violations = files.filter((file) =>
      readFileSync(file, "utf8").includes('from "~/shared/client/'),
    );

    expect(violations).toEqual([]);
  });

  test("shared client primitives do not import feature modules", () => {
    const files = globSync([
      "src/shared/client/components/**/*.ts",
      "src/shared/client/components/**/*.tsx",
      "src/shared/client/entities/**/*.ts",
      "src/shared/client/i18n/**/*.ts",
      "src/shared/client/providers/**/*.ts",
      "src/shared/client/services/**/*.ts",
      "src/shared/client/utils/**/*.ts",
    ]);
    const violations = files.filter((file) =>
      readFileSync(file, "utf8").includes('from "~/modules/'),
    );

    expect(violations).toEqual([]);
  });

  test("feature slices do not import the app store composition", () => {
    const files = globSync("src/modules/*/client/state/**/*.ts");
    const violations = files.filter((file) =>
      readFileSync(file, "utf8").includes('from "~/shared/client/stores'),
    );

    expect(violations).toEqual([]);
  });
});
