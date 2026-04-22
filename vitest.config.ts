import { defineConfig } from "vitest/config";
import { loadModeEnv } from "./plugins/env";

export default defineConfig(({ mode = "test" }) => {
  loadModeEnv(mode);
  return {
    envDir: false,
    resolve: { tsconfigPaths: true },
    test: {
      globals: true,
      environment: "node",
      include: ["tests/**/*.test.ts"],
      setupFiles: ["tests/orquestrator.ts"],
      fileParallelism: false,
      hookTimeout: 60000,
      testTimeout: 30000,
      coverage: {
        include: ["src/server/services/**/*.ts", "src/shared/entities/**/*.ts"],
      },
    },
  };
});
