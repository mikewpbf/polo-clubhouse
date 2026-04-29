import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: "forks",
    forks: {
      singleFork: true,
    },
    env: {
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
    },
  },
  resolve: {
    conditions: ["workspace"],
  },
});
