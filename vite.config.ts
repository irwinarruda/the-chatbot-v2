import { resolve as resolvePath } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { loadModeEnv } from "./plugins/env.ts";
import { persist } from "./plugins/persist.ts";
import { routes as virtualRoutes } from "./src/routes.ts";

export default defineConfig(({ mode }) => {
  loadModeEnv(mode);
  const isMock = mode === "mock";
  return {
    envDir: false,
    nitro: {
      // The compiler is lazy-loaded, so Nitro must trace these packages for the
      // Vercel function even though they are absent from the initial server chunk.
      traceDeps: ["css-tree", "jsdom"],
    },
    resolve: {
      alias: [
        {
          find: /^css-tree$/,
          replacement: resolvePath("node_modules/css-tree/dist/csstree.esm.js"),
        },
      ],
      tsconfigPaths: true,
    },
    ssr: { external: ["jsdom"] },
    plugins: [
      tailwindcss(),
      tanstackStart({
        start: { entry: isMock ? "client/mock/start.ts" : undefined },
        router: {
          entry: isMock ? "client/mock/router.tsx" : undefined,
          routesDirectory: ".",
          generatedRouteTree: "./routeTree.gen.ts",
          virtualRouteConfig: virtualRoutes,
        },
      }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      nitro(),
      persist([
        { src: "infra/package.json", dest: "infra/package.json" },
        { src: "infra/migrations", dest: "infra/migrations" },
        { src: "templates", dest: "templates" },
      ]),
    ],
    server: {
      port: 3000,
      allowedHosts: ["parrot-fun-nicely.ngrok-free.app"],
    },
    preview: {
      port: 3000,
      allowedHosts: ["parrot-fun-nicely.ngrok-free.app"],
    },
  };
});
