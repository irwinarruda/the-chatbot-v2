import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cpSync, existsSync, readdirSync } from "fs";
import { nitro } from "nitro/vite";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import { Env } from "./infra/env";
import { routes as virtualRoutes } from "./src/server/tanstack/index";

Env.load();

const ROOT_ROUTE_ID = "__root__";

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

function seedRoutesManifest(): Plugin {
  const routesManifest = {
    [ROOT_ROUTE_ID]: {
      filePath: path.resolve("src/client/routes/__root.tsx"),
      children: [
        "/",
        "/privacy",
        "/chat",
        "/google/already-signed-in",
        "/google/thank-you",
        "/api/v1/status",
        "/api/v1/migration",
        "/api/v1/whatsapp/webhook",
        "/api/v1/google/login",
        "/api/v1/google/redirect",
        "/api/v1/web/auth/login",
        "/api/v1/web/auth/logout",
        "/api/v1/web/auth/me",
        "/api/v1/web/auth/redirect",
        "/api/v1/web/messages",
        "/api/v1/web/audio",
        "/api/v1/web/stream",
        "/api/v1/tui/messages",
        "/api/v1/tui/audio",
        "/api/v1/tui/stream",
        "/api/v1/tui/transcripts",
      ],
    },
    "/": {
      filePath: path.resolve("src/client/routes/index.tsx"),
    },
    "/privacy": {
      filePath: path.resolve("src/client/routes/privacy.tsx"),
    },
    "/chat": {
      filePath: path.resolve("src/client/routes/chat.tsx"),
      children: ["/chat/", "/chat/not-registered"],
    },
    "/chat/": {
      filePath: path.resolve("src/client/routes/chat/index.tsx"),
    },
    "/chat/not-registered": {
      filePath: path.resolve("src/client/routes/chat/not-registered.tsx"),
    },
    "/google/already-signed-in": {
      filePath: path.resolve("src/client/routes/google/already-signed-in.tsx"),
    },
    "/google/thank-you": {
      filePath: path.resolve("src/client/routes/google/thank-you.tsx"),
    },
    "/api/v1/status": {
      filePath: path.resolve("src/server/tanstack/controllers/status.ts"),
    },
    "/api/v1/migration": {
      filePath: path.resolve("src/server/tanstack/controllers/migration.ts"),
    },
    "/api/v1/whatsapp/webhook": {
      filePath: path.resolve(
        "src/server/tanstack/controllers/whatsapp-webhook.ts",
      ),
    },
    "/api/v1/google/login": {
      filePath: path.resolve("src/server/tanstack/controllers/google-login.ts"),
    },
    "/api/v1/google/redirect": {
      filePath: path.resolve(
        "src/server/tanstack/controllers/google-redirect.ts",
      ),
    },
    "/api/v1/web/auth/login": {
      filePath: path.resolve(
        "src/server/tanstack/controllers/web-auth-login.ts",
      ),
    },
    "/api/v1/web/auth/logout": {
      filePath: path.resolve(
        "src/server/tanstack/controllers/web-auth-logout.ts",
      ),
    },
    "/api/v1/web/auth/me": {
      filePath: path.resolve("src/server/tanstack/controllers/web-auth-me.ts"),
    },
    "/api/v1/web/auth/redirect": {
      filePath: path.resolve(
        "src/server/tanstack/controllers/web-auth-redirect.ts",
      ),
    },
    "/api/v1/web/messages": {
      filePath: path.resolve("src/server/tanstack/controllers/web-messages.ts"),
    },
    "/api/v1/web/audio": {
      filePath: path.resolve("src/server/tanstack/controllers/web-audio.ts"),
    },
    "/api/v1/web/stream": {
      filePath: path.resolve("src/server/tanstack/controllers/web-stream.ts"),
    },
    "/api/v1/tui/messages": {
      filePath: path.resolve("src/server/tanstack/controllers/tui-messages.ts"),
    },
    "/api/v1/tui/audio": {
      filePath: path.resolve("src/server/tanstack/controllers/tui-audio.ts"),
    },
    "/api/v1/tui/stream": {
      filePath: path.resolve("src/server/tanstack/controllers/tui-stream.ts"),
    },
    "/api/v1/tui/transcripts": {
      filePath: path.resolve(
        "src/server/tanstack/controllers/tui-transcripts.ts",
      ),
    },
  };

  return {
    name: "seed-start-routes-manifest",
    buildStart() {
      globalThis.TSS_ROUTES_MANIFEST = routesManifest;
    },
    configureServer() {
      globalThis.TSS_ROUTES_MANIFEST = routesManifest;
    },
  };
}

export function getRouterConfig(nodeEnv = process.env.NODE_ENV) {
  const config = {
    routesDirectory: ".",
    generatedRouteTree: "./routeTree.gen.ts",
    virtualRouteConfig: virtualRoutes,
  };

  if (nodeEnv !== "production") {
    return config;
  }

  return {
    ...config,
    routeFileIgnorePattern: "^tui$",
  };
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
    tailwindcss(),
    tanstackStart({
      router: getRouterConfig(),
    }),
    viteReact(),
    nitro(),
    seedRoutesManifest(),
    copyStaticAssets(),
  ],
});
