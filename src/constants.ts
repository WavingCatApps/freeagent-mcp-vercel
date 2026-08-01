/**
 * FreeAgent MCP Server Constants
 */

// API Base URLs
export const API_BASE_URL = "https://api.freeagent.com";
export const SANDBOX_API_BASE_URL = "https://api.sandbox.freeagent.com";
export const API_VERSION = "v2";

// Character limit for response truncation
export const CHARACTER_LIMIT = 25000;

// Rate limiting
export const RATE_LIMIT_REQUESTS = 15;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

// Response formats
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

/**
 * Normalize a host or URL-ish env value to an https origin.
 * Accepts bare hosts (`example.vercel.app`) or full URLs.
 */
function toHttpsOrigin(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed.replace(/\/$/, "");
  }
  return `https://${trimmed.replace(/\/$/, "")}`;
}

/**
 * Compute the base URL for the server, supporting Vercel deployment URLs.
 *
 * Preview/branch deploys prefer `VERCEL_BRANCH_URL` so FreeAgent's OAuth
 * `redirect_uri` matches this deployment (and registered wildcard redirect
 * URIs), instead of always collapsing to production via `PRODUCTION_URL`.
 *
 * Priority:
 * - preview: VERCEL_BRANCH_URL > VERCEL_URL > BASE_URL > localhost
 * - production / other: PRODUCTION_URL > VERCEL_PROJECT_PRODUCTION_URL >
 *   VERCEL_BRANCH_URL > VERCEL_URL > BASE_URL > localhost
 */
export function getBaseUrl(): string {
  const vercelEnv = process.env.VERCEL_ENV;
  const productionUrl =
    process.env.PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const branchUrl = process.env.VERCEL_BRANCH_URL;
  const vercelUrl = process.env.VERCEL_URL;

  if (vercelEnv === "preview") {
    if (branchUrl) return toHttpsOrigin(branchUrl);
    if (vercelUrl) return toHttpsOrigin(vercelUrl);
    return process.env.BASE_URL || "http://localhost:3000";
  }

  if (productionUrl) return toHttpsOrigin(productionUrl);
  if (branchUrl) return toHttpsOrigin(branchUrl);
  if (vercelUrl) return toHttpsOrigin(vercelUrl);
  return process.env.BASE_URL || "http://localhost:3000";
}
