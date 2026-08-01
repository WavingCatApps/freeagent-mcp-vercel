import { afterEach, describe, expect, it } from "vitest";
import { getBaseUrl, getRequestBaseUrl, toHttpsOrigin } from "./constants.js";

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

describe("toHttpsOrigin", () => {
  it("adds https and strips trailing slash", () => {
    expect(toHttpsOrigin("example.vercel.app/")).toBe("https://example.vercel.app");
  });

  it("keeps an existing https origin", () => {
    expect(toHttpsOrigin("https://example.vercel.app/")).toBe("https://example.vercel.app");
  });
});

describe("getRequestBaseUrl", () => {
  it("uses x-forwarded-host and x-forwarded-proto", () => {
    expect(
      getRequestBaseUrl({
        headers: {
          "x-forwarded-host": "freeagent-mcp-vercel-a3vcrtaem-simonrices-projects.vercel.app",
          "x-forwarded-proto": "https",
        },
        protocol: "http",
      })
    ).toBe("https://freeagent-mcp-vercel-a3vcrtaem-simonrices-projects.vercel.app");
  });

  it("falls back to Host and allows localhost http", () => {
    expect(
      getRequestBaseUrl({
        headers: { host: "localhost:3456" },
        protocol: "http",
      })
    ).toBe("http://localhost:3456");
  });
});

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

  it("prefers VERCEL_URL on preview over branch and PRODUCTION_URL", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.PRODUCTION_URL = "freeagent-mcp-vercel-simonrices-projects.vercel.app";
    process.env.VERCEL_BRANCH_URL =
      "freeagent-mcp-vercel-git-cursor-fix-9d6ab9-simonrices-projects.vercel.app";
    process.env.VERCEL_URL = "freeagent-mcp-vercel-a3vcrtaem-simonrices-projects.vercel.app";

    expect(getBaseUrl()).toBe(
      "https://freeagent-mcp-vercel-a3vcrtaem-simonrices-projects.vercel.app"
    );
  });

  it("falls back to VERCEL_BRANCH_URL on preview when VERCEL_URL is absent", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_BRANCH_URL =
      "freeagent-mcp-vercel-git-cursor-fix-9d6ab9-simonrices-projects.vercel.app";

    expect(getBaseUrl()).toBe(
      "https://freeagent-mcp-vercel-git-cursor-fix-9d6ab9-simonrices-projects.vercel.app"
    );
  });

  it("uses PRODUCTION_URL on production deployments", () => {
    clearUrlEnv();
    process.env.VERCEL_ENV = "production";
    process.env.PRODUCTION_URL = "freeagent-mcp-vercel-simonrices-projects.vercel.app";
    process.env.VERCEL_URL = "freeagent-mcp-vercel-a3vcrtaem-simonrices-projects.vercel.app";

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

  it("falls back to localhost locally", () => {
    clearUrlEnv();
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });
});
