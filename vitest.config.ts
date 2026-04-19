import { config } from "dotenv";
import { defineConfig } from "vitest/config";

var mode = process.env.MODE ?? "test";

config({ path: ".env" });
config({ path: `.env.${mode}`, override: true });

process.env.NODE_ENV = "test";
process.env.MODE = mode;

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/orquestrator.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    coverage: {
      include: [
        "src/server/services/**/*.ts",
        "src/shared/entities/**/*.ts",
      ],
    },
  },
});
