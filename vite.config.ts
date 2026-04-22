import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { loadModeEnv } from "./plugins/env";
import { persist } from "./plugins/persist";
import { routes as virtualRoutes } from "./src/server/tanstack";

export default defineConfig(({ mode }) => {
  loadModeEnv(mode);
  return {
    envDir: false,
    resolve: { tsconfigPaths: true },
    plugins: [
      tailwindcss(),
      tanstackStart({
        router: {
          routesDirectory: ".",
          generatedRouteTree: "./routeTree.gen.ts",
          virtualRouteConfig: virtualRoutes,
        },
      }),
      react(),
      nitro(),
      persist([
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
