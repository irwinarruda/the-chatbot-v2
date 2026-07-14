import { readFileSync } from "fs";
import { globSync } from "tinyglobby";
import { describe, expect, test } from "vitest";

describe("module boundaries", () => {
  test("entities do not import services, gateways, HTTP, or client code", () => {
    const files = globSync([
      "src/modules/*/entities/**/*.ts",
      "src/shared/entities/**/*.ts",
    ]);
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return (
        source
          .match(
            /from ["']~\/(?:infra|shared\/(?:client|http|gateway)|modules\/[^/]+\/(?:client|gateway|services))\//g,
          )
          ?.map(() => file) ?? []
      );
    });

    expect(violations).toEqual([]);
  });

  test("services and gateways do not import client implementation", () => {
    const files = globSync([
      "src/shared/http/**/*.ts",
      "src/modules/*/services/**/*.ts",
      "src/modules/*/gateway/**/*.ts",
    ]);
    const violations = files.filter((file) =>
      readFileSync(file, "utf8").includes('from "~/shared/client/'),
    );

    expect(violations).toEqual([]);
  });

  test("legacy layer directories are not reintroduced", () => {
    const files = globSync([
      "src/modules/*/domain/**",
      "src/modules/*/application/**",
      "src/modules/*/server/**",
      "src/modules/*/services/ports/**",
      "src/shared/server/**",
    ]);

    expect(files).toEqual([]);
  });

  test("every gateway directory publishes its interface from index.ts", () => {
    const gatewayFiles = globSync([
      "src/modules/*/gateway/*/*.ts",
      "src/shared/gateway/*/*.ts",
    ]);
    const directories = new Set(
      gatewayFiles.map((file) => file.slice(0, file.lastIndexOf("/"))),
    );
    const violations = [...directories].filter(
      (directory) => !gatewayFiles.includes(`${directory}/index.ts`),
    );

    expect(violations).toEqual([]);
  });

  test("DTO declarations live in an entities/dtos directory", () => {
    const files = globSync(["src/modules/**/*.ts", "src/shared/**/*.ts"]);
    const violations = files.filter((file) => {
      if (file.includes("/entities/dtos/")) return false;
      return /export (?:const|interface|type) [A-Za-z0-9]+DTO\b/.test(
        readFileSync(file, "utf8"),
      );
    });

    expect(violations).toEqual([]);
  });

  test("contracts contain mappers rather than DTO schemas", () => {
    const files = globSync("src/modules/*/contracts/**/*.ts");
    const violations = files.filter((file) =>
      readFileSync(file, "utf8").includes('from "zod"'),
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
