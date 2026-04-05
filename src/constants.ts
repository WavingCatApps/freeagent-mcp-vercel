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
 * Compute the base URL for the server, supporting Vercel deployment URLs.
 * Priority: PRODUCTION_URL > VERCEL_BRANCH_URL > VERCEL_URL > BASE_URL > localhost
 */
export function getBaseUrl(): string {
  const PRODUCTION_URL = process.env.PRODUCTION_URL;
  const VERCEL_BRANCH_URL = process.env.VERCEL_BRANCH_URL;
  const VERCEL_URL = process.env.VERCEL_URL;

  if (PRODUCTION_URL) return `https://${PRODUCTION_URL}`;
  if (VERCEL_BRANCH_URL) return `https://${VERCEL_BRANCH_URL}`;
  if (VERCEL_URL) return `https://${VERCEL_URL}`;
  return process.env.BASE_URL || "http://localhost:3000";
}
