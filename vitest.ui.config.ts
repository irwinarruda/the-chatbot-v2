import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    fileParallelism: false,
    globals: true,
    include: ["tests/client/**/*.test.tsx"],
    setupFiles: ["tests/support/setup-ui.ts"],
  },
});
