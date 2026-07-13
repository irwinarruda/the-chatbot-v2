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
            /from ["']~\/(?:infra|server|client|shared\/http|modules\/[^/]+\/(?:application|server|client))\//g,
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
      readFileSync(file, "utf8").includes('from "~/client/'),
    );

    expect(violations).toEqual([]);
  });
});
