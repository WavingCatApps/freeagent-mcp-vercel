/**
 * Access token refresh for the stdio server
 *
 * FreeAgent access tokens expire. When FREEAGENT_REFRESH_TOKEN,
 * FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET are set, the API client
 * exchanges the refresh token for a new access token on a 401 and retries.
 * The latest tokens are cached on disk so a restart doesn't fall back to the
 * expired token in the environment.
 */

import { promises as fs } from "fs";
import os from "os";
import path from "path";

export interface CachedTokens {
  access_token: string;
  refresh_token: string;
}

export interface TokenRefresherOptions {
  baseURL: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  cachePath?: string;
}

export const DEFAULT_TOKEN_CACHE = path.join(os.homedir(), ".config", "freeagent-mcp", "tokens.json");

export async function readTokenCache(cachePath: string): Promise<CachedTokens | undefined> {
  try {
    const data = JSON.parse(await fs.readFile(cachePath, "utf8"));
    if (data && typeof data.access_token === "string" && typeof data.refresh_token === "string") {
      return data;
    }
  } catch {
    // No cache yet, or unreadable: fall back to the environment
  }
  return undefined;
}

async function writeTokenCache(cachePath: string, tokens: CachedTokens): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(cachePath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export class TokenRefresher {
  private options: TokenRefresherOptions;
  private refreshTokens: string[];
  private inFlight?: Promise<string>;

  constructor(options: TokenRefresherOptions, cachedRefreshToken?: string) {
    this.options = options;
    // Try the cached refresh token first, then the one from the environment,
    // in case the environment was updated by hand after the cache was written
    this.refreshTokens = [...new Set([cachedRefreshToken, options.refreshToken].filter(Boolean) as string[])];
  }

  /**
   * Get a new access token. Concurrent callers share one request.
   */
  refresh(): Promise<string> {
    if (!this.inFlight) {
      this.inFlight = this.doRefresh().finally(() => {
        this.inFlight = undefined;
      });
    }
    return this.inFlight;
  }

  private async doRefresh(): Promise<string> {
    const { baseURL, clientId, clientSecret, cachePath } = this.options;
    const errors: string[] = [];

    for (const refreshToken of this.refreshTokens) {
      const response = await fetch(`${baseURL}/v2/token_endpoint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        errors.push(`${response.status} ${await response.text()}`);
        continue;
      }

      const data = await response.json() as { access_token: string; refresh_token?: string };
      const tokens: CachedTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
      };
      this.refreshTokens = [...new Set([tokens.refresh_token, ...this.refreshTokens])];

      if (cachePath) {
        try {
          await writeTokenCache(cachePath, tokens);
        } catch (error) {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "warn",
            message: "Could not write token cache",
            data: { cachePath, error: error instanceof Error ? error.message : String(error) },
          }));
        }
      }

      return tokens.access_token;
    }

    throw new Error(`FreeAgent token refresh failed: ${errors.join("; ")}`);
  }
}
