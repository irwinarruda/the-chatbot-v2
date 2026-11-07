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
      hookTimeout: 60_000,
      testTimeout: 60_000,
      coverage: {
        include: [
          "src/domain/**/*.ts",
          "src/contracts/**/*.ts",
          "src/server/**/*.ts",
        ],
      },
    },
  };
});
