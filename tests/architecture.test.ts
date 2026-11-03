import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const RepoRoot = path.resolve(import.meta.dirname, "..");
const ModuleLevels: Record<string, number> = {
  system: 1,
  identity: 2,
  chat: 3,
  accounts: 4,
  artifacts: 4,
  "cash-flow": 4,
  notes: 4,
  todos: 4,
};
const StaticImport =
  /^\s*(?:import|export)(\s+type)?\s+(?:[\w$*{},\s]*?from\s*)?["']([^"']+)["']/gm;
const DynamicImport = /(?<![\w$.])import\s*\(\s*["']([^"']+)["']/g;
const Domain = /^~\/domain\//;
const Contracts = /^~\/contracts\//;
const ServerLayers: Record<string, RegExp[]> = {
  controllers: [
    /^~\/server\/modules\/[^/]+\/services\//,
    /^~\/server\/shared\//,
    /^~\/server\/production$/,
  ],
  services: [
    /^~\/server\/modules\/[^/]+\/services\//,
    /^~\/server\/modules\/[^/]+\/repositories\//,
    /^~\/server\/modules\/[^/]+\/gateways\/[a-z-]+$/,
    /^~\/server\/modules\/[^/]+\/utils\//,
    /^~\/server\/shared\/(config|database\/database|errors|gateways)\//,
    /^~\/server\/shared\/database\/database$/,
  ],
  repositories: [
    /^~\/server\/modules\/[^/]+\/gateways\/[a-z-]+$/,
    /^~\/server\/modules\/[^/]+\/utils\//,
    /^~\/server\/shared\/database\/database$/,
    /^~\/server\/shared\/config\//,
  ],
  gateways: [
    /^~\/server\/modules\/[^/]+\/gateways\//,
    /^~\/server\/modules\/[^/]+\/utils\//,
    /^~\/server\/shared\/(config|errors)\//,
    /^~\/server\/shared\/database\/database$/,
  ],
  utils: [
    /^~\/server\/modules\/[^/]+\/utils\//,
    /^~\/server\/shared\/(config|errors)\//,
  ],
};
const ClientApp = /^modules\/[^/]+\/app\/|^shared\/app\//;
const ClientView =
  /^modules\/[^/]+\/(screens|components)\/|^shared\/components\/|^routes\//;
const ClientForbiddenInApp = [
  /^react$/,
  /^react-dom/,
  /^@tanstack\//,
  /\/screens\//,
  /\/components\//,
  /^~\/client\/routes\//,
];
const ClientForbiddenInViews = [/\/app\/repositories\//, /\/app\/gateways\//];
const ServerFunctions = /^~\/server\/shared\/http\/functions\/[a-z-]+$/;
const TestDouble = /\/gateways\/test\./;
const AllowedComment = /^\s*(?:\/\/\/ <reference|\/\/ biome-ignore)/;

function readSources(directory: string) {
  const root = path.join(RepoRoot, directory);
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith(".gen.ts"))
    .map((file) => ({
      file: file.replaceAll("\\", "/"),
      source: readFileSync(path.join(root, file), "utf8"),
    }));
}

function importsOf(source: string) {
  return [...source.matchAll(StaticImport)]
    .map((match) => match[2])
    .concat([...source.matchAll(DynamicImport)].map((match) => match[1]));
}

function offenders(
  directory: string,
  isBad: (file: string, specifier: string) => boolean,
) {
  return readSources(directory).flatMap(({ file, source }) =>
    importsOf(source)
      .filter((specifier) => isBad(file, specifier))
      .map((specifier) => `${directory}/${file} imports ${specifier}`),
  );
}

describe("the code base", () => {
  test("has no parent-relative imports", () => {
    const roots = ["src", "tests"];
    expect(
      roots.flatMap((root) =>
        offenders(root, (_file, specifier) => specifier.startsWith("../")),
      ),
    ).toEqual([]);
  });

  test("has no comments in production code", () => {
    const commented = readSources("src")
      .filter(({ file }) => !file.startsWith("client/shared/components/ui/"))
      .filter(({ source }) =>
        source
          .split("\n")
          .some(
            (line) =>
              /^\s*(?:\/\/|\/\*)/.test(line) && !AllowedComment.test(line),
          ),
      )
      .map(({ file }) => file);
    expect(commented).toEqual([]);
  });

  test("has no TS enums", () => {
    const found = readSources("src")
      .filter(({ source }) =>
        /^\s*(?:export\s+)?(?:const\s+)?enum\s/m.test(source),
      )
      .map(({ file }) => file);
    expect(found).toEqual([]);
  });

  test("keeps tests under their level and owner", () => {
    const files = readdirSync(path.join(RepoRoot, "tests"), {
      recursive: true,
      encoding: "utf8",
    }).filter((file) => /\.test\.tsx?$/.test(file));
    const placement =
      /^((domain|contracts|server|client|integration)\/[a-z-]+\/|infra\/|architecture\.test\.ts$)/;
    expect(files.filter((file) => !placement.test(file))).toEqual([]);
  });
});

describe("domain", () => {
  test("is pure: no I/O, no framework, no other layer", () => {
    const bad = offenders("src/domain", (_file, specifier) => {
      return !/^(zod|uuid|~\/domain\/.+|\.\/.+)$/.test(specifier);
    });
    expect(bad).toEqual([]);
    const environment = readSources("src/domain")
      .filter(({ source }) => /process\.|import\.meta\.env|Bun\./.test(source))
      .map(({ file }) => file);
    expect(environment).toEqual([]);
  });
});

describe("contracts", () => {
  test("never reads the environment", () => {
    const readers = readSources("src/contracts")
      .filter(({ source }) => /process\.|import\.meta\.env|Bun\./.test(source))
      .map(({ file }) => file);
    expect(readers).toEqual([]);
  });

  test("imports only zod, the domain and itself", () => {
    const bad = offenders("src/contracts", (_file, specifier) => {
      return !/^(zod|~\/domain\/.+|~\/contracts\/.+|\.\/.+)$/.test(specifier);
    });
    expect(bad).toEqual([]);
  });
});

describe("server", () => {
  const moduleFile = /^modules\/([^/]+)\/([^/]+)\//;

  test("keeps every layer to its table", () => {
    const bad = offenders("src/server", (file, specifier) => {
      const match = moduleFile.exec(file);
      if (!match || !specifier.startsWith("~/")) return false;
      if (Domain.test(specifier) || Contracts.test(specifier)) return false;
      const [, moduleName, layer] = match;
      if (specifier.startsWith(`~/server/modules/${moduleName}/${layer}/`)) {
        return false;
      }
      return !(ServerLayers[layer] ?? []).some((pattern) =>
        pattern.test(specifier),
      );
    });
    expect(bad).toEqual([]);
  });

  test("imports modules only downward", () => {
    const bad = offenders("src/server", (file, specifier) => {
      const from = moduleFile.exec(file)?.[1];
      const to = /^~\/server\/modules\/([^/]+)\//.exec(specifier)?.[1];
      if (!from || !to || from === to) return false;
      return (ModuleLevels[to] ?? 99) >= (ModuleLevels[from] ?? 0);
    });
    expect(bad).toEqual([]);
    const unknown = readdirSync(
      path.join(RepoRoot, "src/server/modules"),
    ).filter((module) => ModuleLevels[module] === undefined);
    expect(unknown).toEqual([]);
  });

  test("reaches the production graph only from the HTTP edge", () => {
    const edge =
      /^(modules\/[^/]+\/controllers\/|shared\/http\/(middleware|functions)\/)/;
    const bad = offenders("src/server", (file, specifier) => {
      if (specifier !== "~/server/production") return false;
      return !edge.test(file);
    });
    expect(bad).toEqual([]);
  });

  test("never imports the client", () => {
    const bad = offenders("src/server", (_file, specifier) =>
      specifier.startsWith("~/client/"),
    );
    expect(bad).toEqual([]);
  });

  test("reads the environment only at the composition root", () => {
    const readers = readSources("src/server")
      .filter(
        ({ file, source }) =>
          file !== "production.ts" &&
          /process\.env|import\.meta\.env/.test(source),
      )
      .map(({ file }) => file);
    expect(readers).toEqual([]);
  });

  test("keeps Node and the database out of services", () => {
    const bad = offenders("src/server", (file, specifier) => {
      if (moduleFile.exec(file)?.[2] !== "services") return false;
      return /^(node:|fs$|path$|crypto$|postgres$|pg$)/.test(specifier);
    });
    expect(bad).toEqual([]);
    const sql = readSources("src/server/modules")
      .filter(({ file }) => file.includes("/services/"))
      .filter(({ source }) => /\.sql\s*(<[^>]*>)?\s*`|\bsql`/.test(source))
      .map(({ file }) => file);
    expect(sql).toEqual([]);
  });

  test("gives every gateway implementation an interface beside it", () => {
    const files = readSources("src/server/modules")
      .map(({ file }) => file)
      .filter((file) => /\/gateways\/[^/]+\.ts$/.test(file));
    const ports = new Set(
      files.filter((file) => !/\/gateways\/[^/]+\.[^/]+\.ts$/.test(file)),
    );
    const missing = files
      .filter((file) => /\/gateways\/[a-z-]+\.[a-z-]+\.ts$/.test(file))
      .filter(
        (file) =>
          !/\.(message-mapper|assistant-progress|assistant-response|credential-store|auth-scopes)\.ts$/.test(
            file,
          ),
      )
      .filter(
        (file) => !ports.has(file.replace(/\/[a-z-]+\.([a-z-]+\.ts)$/, "/$1")),
      );
    expect(missing).toEqual([]);
  });

  test("keeps test doubles out of production wiring", () => {
    const wiring = readSources("src/server").filter(
      ({ file }) => file === "production.ts" || file === "server.ts",
    );
    const doubles = wiring
      .flatMap(({ source }) => importsOf(source))
      .filter((specifier) => TestDouble.test(specifier));
    expect(doubles).toEqual([]);
  });
});

describe("client", () => {
  test("keeps the application layer free of the view", () => {
    const bad = offenders("src/client", (file, specifier) => {
      if (!ClientApp.test(file)) return false;
      return ClientForbiddenInApp.some((pattern) => pattern.test(specifier));
    });
    expect(bad).toEqual([]);
  });

  test("never lets a view reach a repository or gateway", () => {
    const bad = offenders("src/client", (file, specifier) => {
      if (!ClientView.test(file)) return false;
      return ClientForbiddenInViews.some((pattern) => pattern.test(specifier));
    });
    expect(bad).toEqual([]);
  });

  test("reaches the server only through server functions", () => {
    const bad = offenders("src/client", (_file, specifier) => {
      if (!specifier.startsWith("~/server/")) return false;
      return !ServerFunctions.test(specifier);
    });
    expect(bad).toEqual([]);
  });

  test("keeps demo data and test adapters out of production code", () => {
    const bad = offenders("src", (file, specifier) => {
      if (file.startsWith("client/mock/")) return false;
      return specifier.startsWith("~/client/mock/");
    });
    expect(bad).toEqual([]);
  });

  test("never hardcodes a color, so every screen follows the theme", () => {
    const colored = readSources("src/client")
      .filter(({ source }) =>
        /["'`]#[0-9a-fA-F]{3,8}["'`]|rgba?\(/.test(source),
      )
      .map(({ file }) => file);
    expect(colored).toEqual([]);
  });
});
