import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: { DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db" },
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
