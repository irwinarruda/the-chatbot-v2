import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cpSync, existsSync, readdirSync } from "fs";
import { nitro } from "nitro/vite";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import { loadEnv } from "./infra/env";

loadEnv();

function copyStaticAssets(): Plugin {
  return {
    name: "copy-static-assets",
    closeBundle() {
      const assets = [
        {
          src: path.resolve("infra", "migrations"),
          dest: path.join("infra", "migrations"),
        },
        {
          src: path.resolve("templates"),
          dest: "templates",
        },
      ];

      // Collect server output directories for all possible presets
      const serverDirs: string[] = [];

      // node-server preset: .output/server/
      const nodeServerDir = path.resolve(".output", "server");
      if (existsSync(nodeServerDir)) {
        serverDirs.push(nodeServerDir);
      }

      // vercel preset: .vercel/output/functions/<name>.func/
      const vercelFunctionsDir = path.resolve(".vercel", "output", "functions");
      if (existsSync(vercelFunctionsDir)) {
        for (const entry of readdirSync(vercelFunctionsDir)) {
          if (entry.endsWith(".func")) {
            serverDirs.push(path.join(vercelFunctionsDir, entry));
          }
        }
      }

      for (const serverDir of serverDirs) {
        for (const { src, dest } of assets) {
          if (!existsSync(src)) continue;
          const destPath = path.join(serverDir, dest);
          cpSync(src, destPath, { recursive: true });
          console.log(`[copy-static-assets] Copied ${dest} to ${destPath}`);
        }
      }
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
    allowedHosts: ["parrot-fun-nicely.ngrok-free.app"],
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
    viteReact(),
    nitro(),
    copyStaticAssets(),
  ],
});
