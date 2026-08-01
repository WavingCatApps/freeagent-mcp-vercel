import { afterEach, describe, expect, it } from "vitest";
import { getBaseUrl } from "./constants.js";

const ENV_KEYS = [
  "VERCEL_ENV",
  "PRODUCTION_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_URL",
  "BASE_URL",
] as const;

const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function clearUrlEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("getBaseUrl", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }

  it("uses VERCEL_BRANCH_URL on preview even when PRODUCTION_URL is set", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.PRODUCTION_URL = "freeagent-mcp-vercel-simonrices-projects.vercel.app";
    process.env.VERCEL_BRANCH_URL =
      "freeagent-mcp-vercel-git-cursor-fix-9d6ab9-simonrices-projects.vercel.app";
    process.env.VERCEL_URL = "freeagent-mcp-vercel-dxfroy8nk-simonrices-projects.vercel.app";

    expect(getBaseUrl()).toBe(
      "https://freeagent-mcp-vercel-git-cursor-fix-9d6ab9-simonrices-projects.vercel.app"
    );
  });

  it("falls back to VERCEL_URL on preview when branch URL is absent", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.PRODUCTION_URL = "freeagent-mcp-vercel-simonrices-projects.vercel.app";
    process.env.VERCEL_URL = "freeagent-mcp-vercel-dxfroy8nk-simonrices-projects.vercel.app";

    expect(getBaseUrl()).toBe(
      "https://freeagent-mcp-vercel-dxfroy8nk-simonrices-projects.vercel.app"
    );
  });

  it("uses PRODUCTION_URL on production deployments", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "production";
    process.env.PRODUCTION_URL = "freeagent-mcp-vercel-simonrices-projects.vercel.app";
    process.env.VERCEL_BRANCH_URL =
      "freeagent-mcp-vercel-git-master-simonrices-projects.vercel.app";

    expect(getBaseUrl()).toBe(
      "https://freeagent-mcp-vercel-simonrices-projects.vercel.app"
    );
  });

  it("uses VERCEL_PROJECT_PRODUCTION_URL when PRODUCTION_URL is unset", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL =
      "freeagent-mcp-vercel-simonrices-projects.vercel.app";

    expect(getBaseUrl()).toBe(
      "https://freeagent-mcp-vercel-simonrices-projects.vercel.app"
    );
  });

  it("accepts a full https PRODUCTION_URL without double-prefixing", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "production";
    process.env.PRODUCTION_URL =
      "https://freeagent-mcp-vercel-simonrices-projects.vercel.app/";

    expect(getBaseUrl()).toBe(
      "https://freeagent-mcp-vercel-simonrices-projects.vercel.app"
    );
  });

  it("falls back to localhost locally", () => {
    clearUrlEnv();
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });
});
