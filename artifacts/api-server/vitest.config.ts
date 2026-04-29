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
    // All test files share a single PostgreSQL database, and some tests perform
    // global writes (e.g. the admin players cleanup endpoint deletes every
    // player with zero match events). Run files sequentially so a destructive
    // test cannot race with another file's setup/teardown.
    fileParallelism: false,
    env: {
      LOG_LEVEL: "silent",
      NODE_ENV: "test",
    },
  },
  resolve: {
    conditions: ["workspace"],
  },
});
