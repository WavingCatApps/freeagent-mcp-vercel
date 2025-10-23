/**
 * FreeAgent OAuth Token Validator
 *
 * This module validates FreeAgent OAuth tokens by making a test API call.
 * We act as a Resource Server that accepts FreeAgent tokens directly.
 */

import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

// Get configuration from environment
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";

// FreeAgent API base URL
const FREEAGENT_API_URL = USE_SANDBOX
  ? "https://api.sandbox.freeagent.com"
  : "https://api.freeagent.com";

/**
 * FreeAgent Token Verifier
 *
 * Validates FreeAgent OAuth tokens by making a test API call to FreeAgent.
 * The token is valid if FreeAgent accepts it.
 */
export class FreeAgentTokenVerifier implements OAuthTokenVerifier {
  /**
   * Verify a FreeAgent access token by making a lightweight API call
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      // Make a lightweight API call to verify the token
      // We'll use the /v2/company endpoint as it's simple and every user has access
      const response = await fetch(`${FREEAGENT_API_URL}/v2/company`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid or expired FreeAgent token");
        }
        throw new Error(`FreeAgent API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract user/company info from the response
      // FreeAgent returns company data, we can use the company URL as a client identifier
      const companyUrl = data.company?.url || "freeagent-user";

      return {
        token,  // The FreeAgent access token
        clientId: companyUrl,  // Use company URL as the client identifier
        scopes: ["freeagent"],
        // No explicit expiration - FreeAgent tokens expire after 1 hour,
        // but they'll fail validation when expired anyway
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Token verification failed: ${error.message}`);
      }
      throw new Error("Token verification failed");
    }
  }
}

/**
 * Create a FreeAgent token verifier instance
 */
export function createFreeAgentTokenVerifier(): FreeAgentTokenVerifier {
  return new FreeAgentTokenVerifier();
}
