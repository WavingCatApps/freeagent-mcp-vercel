import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      JWT_SECRET: "test-jwt-secret-for-vitest",
      FREEAGENT_CLIENT_ID: "test-client-id",
      FREEAGENT_CLIENT_SECRET: "test-client-secret",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
