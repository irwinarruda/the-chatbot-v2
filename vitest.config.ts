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
      hookTimeout: 120000,
      testTimeout: 120000,
      coverage: {
        include: [
          "src/modules/*/application/**/*.ts",
          "src/modules/*/domain/**/*.ts",
          "src/shared/http/**/*.ts",
        ],
      },
    },
  };
});
