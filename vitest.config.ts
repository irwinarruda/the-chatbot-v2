import { defineConfig } from "vitest/config";
import { loadModeEnv } from "./plugins/env.ts";

export default defineConfig(({ mode = "test" }) => {
  loadModeEnv(mode);
  return {
    envDir: false,
    resolve: { tsconfigPaths: true },
    test: {
      globals: true,
      environment: "node",
      include: ["tests/**/*.test.ts"],
      fileParallelism: false,
      hookTimeout: 120000,
      testTimeout: 120000,
      coverage: {
        include: [
          "src/modules/*/services/**/*.ts",
          "src/modules/*/entities/**/*.ts",
          "src/modules/*/contracts/**/*.ts",
          "src/shared/http/**/*.ts",
        ],
      },
    },
  };
});
