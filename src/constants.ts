/**
 * FreeAgent MCP Server Constants
 */

import type { Request } from "express";

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
export function toHttpsOrigin(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed.replace(/\/$/, "");
  }
  return `https://${trimmed.replace(/\/$/, "")}`;
}

/**
 * Derive this deployment's public origin from the incoming request.
 * Prefers X-Forwarded-Host (Vercel) so OAuth issuer/redirect_uri match the
 * host the MCP client actually configured — e.g. a per-deploy URL that fits
 * FreeAgent's alphanumeric `*` redirect wildcards.
 */
export function getRequestBaseUrl(req: Pick<Request, "headers" | "protocol">): string | undefined {
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = req.headers.host;
  const rawHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || hostHeader;
  if (!rawHost) return undefined;

  // X-Forwarded-Host can be a comma-separated list; take the first.
  const host = rawHost.split(",")[0]?.trim();
  if (!host) return undefined;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const proto = (protoHeader?.split(",")[0]?.trim() || req.protocol || "https").replace(/:$/, "");

  // Local HTTP is fine for tests/dev; everything else should be https for OAuth.
  if (proto === "http" && (host.startsWith("localhost") || host.startsWith("127.0.0.1"))) {
    return `http://${host}`;
  }
  return toHttpsOrigin(host);
}

/**
 * Compute the fallback base URL from environment (no request context).
 *
 * Preview prefers `VERCEL_URL` (per-deploy host like `…-a3vcrtaem-…`) over
 * `VERCEL_BRANCH_URL` because FreeAgent redirect wildcards only match one
 * alphanumeric segment — branch aliases have too many hyphen segments.
 *
 * When a request is available, prefer {@link getRequestBaseUrl} instead.
 *
 * Priority:
 * - preview: VERCEL_URL > VERCEL_BRANCH_URL > BASE_URL > localhost
 * - production / other: PRODUCTION_URL > VERCEL_PROJECT_PRODUCTION_URL >
 *   VERCEL_URL > VERCEL_BRANCH_URL > BASE_URL > localhost
 */
export function getBaseUrl(): string {
  const vercelEnv = process.env.VERCEL_ENV;
  const productionUrl =
    process.env.PRODUCTION_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const branchUrl = process.env.VERCEL_BRANCH_URL;
  const vercelUrl = process.env.VERCEL_URL;

  if (vercelEnv === "preview") {
    // Prefer the short per-deploy URL so FreeAgent `…-vercel-*-simonrices-…`
    // wildcards match; branch aliases need many more `*` segments.
    if (vercelUrl) return toHttpsOrigin(vercelUrl);
    if (branchUrl) return toHttpsOrigin(branchUrl);
    return process.env.BASE_URL || "http://localhost:3000";
  }

  if (productionUrl) return toHttpsOrigin(productionUrl);
  if (vercelUrl) return toHttpsOrigin(vercelUrl);
  if (branchUrl) return toHttpsOrigin(branchUrl);
  return process.env.BASE_URL || "http://localhost:3000";
}
