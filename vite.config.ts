import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import fs from "fs";
import { nitro } from "nitro/vite";
import path from "path";
import ts from "typescript";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { loadEnv } from "./src/infra/env";

loadEnv();

function compileMigrations(): Plugin {
  const VIRTUAL_ID = "virtual:compiled-migrations";
  const RESOLVED_ID = "\0" + VIRTUAL_ID;
  let migrationData: Record<string, string> = {};

  return {
    name: "compile-migrations",
    buildStart() {
      const srcDir = path.resolve("src", "infra", "migrations");
      if (!fs.existsSync(srcDir)) return;
      const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".ts"));
      migrationData = {};
      for (const file of files) {
        const source = fs.readFileSync(path.join(srcDir, file), "utf-8");
        const { outputText } = ts.transpileModule(source, {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        });
        migrationData[file.replace(/\.ts$/, ".js")] = outputText;
      }
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id === RESOLVED_ID) {
        return `export default ${JSON.stringify(migrationData)};`;
      }
    },
    closeBundle() {
      if (Object.keys(migrationData).length === 0) return;
      const outDir = path.resolve(".output", "server", "infra", "migrations");
      fs.mkdirSync(outDir, { recursive: true });
      for (const [file, content] of Object.entries(migrationData)) {
        fs.writeFileSync(path.join(outDir, file), content);
      }
      console.log(
        `[compile-migrations] Compiled ${Object.keys(migrationData).length} migration(s)`,
      );
    },
  };
}

export function getRouterConfig(nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv !== "production") return {};
  return { routeFileIgnorePattern: "^tui$" };
}

export default defineConfig({
  server: {
    port: 3000,
    // ...(process.env.NODE_ENV !== "production" && {
    allowedHosts: ["parrot-fun-nicely.ngrok-free.app"],
    // }),
  },
  preview: {
    port: 3000,
    allowedHosts: ["parrot-fun-nicely.ngrok-free.app"],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      router: getRouterConfig(),
    }),
    nitro(),
    viteReact(),
    compileMigrations(),
  ],
});
