import { readFileSync } from "fs";
import * as tinyglobby from "tinyglobby";
import { describe, expect, test } from "vitest";

describe("module boundaries", () => {
  test("entities do not import services, gateways, HTTP, or client code", () => {
    const files = tinyglobby.globSync([
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
    const files = tinyglobby.globSync([
      "src/shared/http/**/*.ts",
      "src/modules/*/services/**/*.ts",
      "src/modules/*/gateway/**/*.ts",
    ]);
    const violations = files.filter((file) =>
      /from ["']~\/(?:shared|modules\/[^/]+)\/client\//.test(
        readFileSync(file, "utf8"),
      ),
    );

    expect(violations).toEqual([]);
  });

  test("legacy layer directories are not reintroduced", () => {
    const files = tinyglobby.globSync([
      "src/modules/*/domain/**",
      "src/modules/*/application/**",
      "src/modules/*/server/**",
      "src/modules/*/services/ports/**",
      "src/shared/server/**",
    ]);

    expect(files).toEqual([]);
  });

  test("services do not resolve the application graph", () => {
    const files = tinyglobby.globSync("src/modules/*/services/**/*.ts");
    const violations = files.filter((file) =>
      /from ["']~\/infra\/(?:bootstrap|server-bootstrap)["']/.test(
        readFileSync(file, "utf8"),
      ),
    );

    expect(violations).toEqual([]);
  });

  test("services do not depend on HTTP implementation", () => {
    const files = tinyglobby.globSync("src/modules/*/services/**/*.ts");
    const violations = files.filter((file) =>
      /from ["']~\/shared\/http\//.test(readFileSync(file, "utf8")),
    );

    expect(violations).toEqual([]);
  });

  test("feature modules have no circular dependencies", () => {
    const files = tinyglobby.globSync("src/modules/**/*.{ts,tsx}");
    const dependencies = new Map<string, Set<string>>();
    for (const file of files) {
      const module = file.split("/")[2];
      const imports = dependencies.get(module) ?? new Set<string>();
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /(?:from\s*|import\s*\(\s*)["']~\/modules\/([^/"']+)/g,
      )) {
        if (match[1] !== module) imports.add(match[1]);
      }
      dependencies.set(module, imports);
    }

    const visited = new Set<string>();
    const cycles: string[] = [];
    function visit(module: string, path: string[]) {
      if (path.includes(module)) {
        cycles.push([...path, module].join(" -> "));
        return;
      }
      if (visited.has(module)) return;
      visited.add(module);
      for (const dependency of dependencies.get(module) ?? []) {
        visit(dependency, [...path, module]);
      }
    }
    for (const module of dependencies.keys()) visit(module, []);

    expect(cycles).toEqual([]);
  });

  test("every gateway directory publishes its interface from index.ts", () => {
    const gatewayFiles = tinyglobby.globSync([
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
    const files = tinyglobby.globSync([
      "src/modules/**/*.ts",
      "src/shared/**/*.ts",
    ]);
    const violations = files.filter((file) => {
      if (file.includes("/entities/dtos/")) return false;
      return /export (?:const|interface|type) [A-Za-z0-9]+DTO\b/.test(
        readFileSync(file, "utf8"),
      );
    });

    expect(violations).toEqual([]);
  });

  test("DTO directory declarations use the uppercase DTO suffix", () => {
    const files = tinyglobby.globSync([
      "src/modules/*/entities/dtos/**/*.ts",
      "src/modules/*/client/entities/dtos/**/*.ts",
      "src/shared/entities/dtos/**/*.ts",
      "src/shared/client/entities/dtos/**/*.ts",
    ]);
    const violations = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/export (?:const|interface|type) ([A-Z]\w*)/g)]
        .map((match) => match[1])
        .filter((name) => !name.endsWith("DTO"))
        .map((name) => `${file}:${name}`);
    });

    expect(violations).toEqual([]);
  });

  test("contracts contain mappers rather than DTO schemas", () => {
    const files = tinyglobby.globSync("src/modules/*/contracts/**/*.ts");
    const violations = files.filter((file) =>
      readFileSync(file, "utf8").includes('from "zod"'),
    );

    expect(violations).toEqual([]);
  });

  test("shared client primitives do not import feature modules", () => {
    const files = tinyglobby.globSync([
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
    const files = tinyglobby.globSync("src/modules/*/client/state/**/*.ts");
    const violations = files.filter((file) =>
      readFileSync(file, "utf8").includes('from "~/shared/client/stores'),
    );

    expect(violations).toEqual([]);
  });
});
