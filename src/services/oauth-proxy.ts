/**
 * OAuth Proxy Provider for FreeAgent
 *
 * This acts as an OAuth Authorization Server that proxies authentication to FreeAgent.
 * Flow:
 * 1. Claude → Our /authorize endpoint
 * 2. We → Redirect to FreeAgent login
 * 3. FreeAgent → Redirects back to us with auth code
 * 4. We → Exchange FreeAgent code for FreeAgent tokens
 * 5. We → Issue MCP tokens to Claude (mapped to FreeAgent tokens)
 */

import { Response } from "express";
import { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import crypto from "crypto";

// Configuration
const FREEAGENT_CLIENT_ID = process.env.FREEAGENT_CLIENT_ID!;
const FREEAGENT_CLIENT_SECRET = process.env.FREEAGENT_CLIENT_SECRET!;
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";
const VERCEL_URL = process.env.VERCEL_URL;
const BASE_URL = VERCEL_URL ? `https://${VERCEL_URL}` : (process.env.BASE_URL || "http://localhost:3000");

const FREEAGENT_BASE = USE_SANDBOX
  ? "https://api.sandbox.freeagent.com"
  : "https://api.freeagent.com";

// In-memory stores (in production, use Redis/PostgreSQL)
interface AuthCodeData {
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
  state?: string;
  freeagentCode?: string; // FreeAgent's auth code
}

interface TokenData {
  mcpToken: string;
  freeagentAccessToken: string;
  freeagentRefreshToken: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

const authCodes = new Map<string, AuthCodeData>();
const tokens = new Map<string, TokenData>();
const clients = new Map<string, OAuthClientInformationFull>();

/**
 * Simple client store for dynamic client registration
 */
class ProxyClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return clients.get(clientId);
  }

  async registerClient(clientMetadata: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
    clients.set(clientMetadata.client_id, clientMetadata);
    return clientMetadata;
  }
}

/**
 * FreeAgent OAuth Proxy Provider
 */
export class FreeAgentOAuthProxyProvider implements OAuthServerProvider {
  clientsStore: OAuthRegisteredClientsStore;

  constructor() {
    this.clientsStore = new ProxyClientsStore();
  }

  /**
   * Handle authorization request by redirecting to FreeAgent
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    try {
      // Generate our authorization code
      const ourAuthCode = crypto.randomBytes(32).toString('base64url');

      // Store the authorization request details
      authCodes.set(ourAuthCode, {
        codeChallenge: params.codeChallenge,
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        state: params.state,
      });

      // Build FreeAgent authorization URL
      const freeagentAuthUrl = new URL(`${FREEAGENT_BASE}/v2/approve_app`);
      freeagentAuthUrl.searchParams.set("client_id", FREEAGENT_CLIENT_ID);
      freeagentAuthUrl.searchParams.set("response_type", "code");

      // Use our callback URL to intercept FreeAgent's response
      freeagentAuthUrl.searchParams.set("redirect_uri", `${BASE_URL}/oauth/callback`);

      // Pass our auth code as state so we can match it on callback
      freeagentAuthUrl.searchParams.set("state", ourAuthCode);

      // Redirect to FreeAgent
      res.redirect(freeagentAuthUrl.toString());
    } catch (error) {
      const errorUrl = new URL(params.redirectUri);
      errorUrl.searchParams.set("error", "server_error");
      errorUrl.searchParams.set("error_description", `Authorization failed: ${error}`);
      if (params.state) {
        errorUrl.searchParams.set("state", params.state);
      }
      res.redirect(errorUrl.toString());
    }
  }

  /**
   * Handle callback from FreeAgent (called by our /oauth/callback endpoint)
   */
  async handleFreeAgentCallback(ourAuthCode: string, freeagentCode: string): Promise<{
    redirectUri: string;
    code: string;
    state?: string;
  }> {
    const authData = authCodes.get(ourAuthCode);
    if (!authData) {
      throw new Error("Invalid authorization code");
    }

    // Store the FreeAgent code
    authData.freeagentCode = freeagentCode;
    authCodes.set(ourAuthCode, authData);

    return {
      redirectUri: authData.redirectUri,
      code: ourAuthCode,
      state: authData.state,
    };
  }

  /**
   * Return the PKCE challenge for an authorization code
   */
  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const authData = authCodes.get(authorizationCode);
    if (!authData) {
      throw new Error("Invalid authorization code");
    }
    return authData.codeChallenge;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    const authData = authCodes.get(authorizationCode);
    if (!authData || !authData.freeagentCode) {
      throw new Error("Invalid or expired authorization code");
    }

    try {
      // Exchange FreeAgent code for FreeAgent tokens
      const tokenResponse = await fetch(`${FREEAGENT_BASE}/v2/token_endpoint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${FREEAGENT_CLIENT_ID}:${FREEAGENT_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: authData.freeagentCode,
          redirect_uri: `${BASE_URL}/oauth/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`FreeAgent token exchange failed: ${error}`);
      }

      const freeagentTokens = await tokenResponse.json();

      // Generate our MCP tokens
      const mcpAccessToken = crypto.randomBytes(32).toString('base64url');
      const mcpRefreshToken = crypto.randomBytes(32).toString('base64url');

      // Store the token mapping
      const expiresAt = Date.now() + ((freeagentTokens.expires_in || 3600) * 1000);
      tokens.set(mcpAccessToken, {
        mcpToken: mcpAccessToken,
        freeagentAccessToken: freeagentTokens.access_token,
        freeagentRefreshToken: freeagentTokens.refresh_token,
        clientId: client.client_id,
        scopes: ["freeagent"],
        expiresAt,
      });

      // Clean up auth code
      authCodes.delete(authorizationCode);

      return {
        access_token: mcpAccessToken,
        token_type: "bearer",
        expires_in: freeagentTokens.expires_in || 3600,
        refresh_token: mcpRefreshToken,
      };
    } catch (error) {
      authCodes.delete(authorizationCode);
      throw error;
    }
  }

  /**
   * Exchange refresh token for new access token
   */
  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    _scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    // Find the token data by refresh token
    const tokenData = Array.from(tokens.values()).find(t =>
      t.freeagentRefreshToken === refreshToken && t.clientId === client.client_id
    );

    if (!tokenData) {
      throw new Error("Invalid refresh token");
    }

    // Refresh with FreeAgent
    const tokenResponse = await fetch(`${FREEAGENT_BASE}/v2/token_endpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${FREEAGENT_CLIENT_ID}:${FREEAGENT_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenData.freeagentRefreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("FreeAgent refresh failed");
    }

    const freeagentTokens = await tokenResponse.json();

    // Generate new MCP tokens
    const newMcpAccessToken = crypto.randomBytes(32).toString('base64url');
    const newExpiresAt = Date.now() + ((freeagentTokens.expires_in || 3600) * 1000);

    // Remove old token
    tokens.delete(tokenData.mcpToken);

    // Store new token mapping
    tokens.set(newMcpAccessToken, {
      mcpToken: newMcpAccessToken,
      freeagentAccessToken: freeagentTokens.access_token,
      freeagentRefreshToken: freeagentTokens.refresh_token,
      clientId: client.client_id,
      scopes: tokenData.scopes,
      expiresAt: newExpiresAt,
    });

    return {
      access_token: newMcpAccessToken,
      token_type: "bearer",
      expires_in: freeagentTokens.expires_in || 3600,
      refresh_token: refreshToken,
    };
  }

  /**
   * Verify an MCP access token
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const tokenData = tokens.get(token);

    if (!tokenData) {
      throw new Error("Invalid access token");
    }

    if (Date.now() >= tokenData.expiresAt) {
      tokens.delete(token);
      throw new Error("Access token expired");
    }

    return {
      token,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      expiresAt: Math.floor(tokenData.expiresAt / 1000),
    };
  }

  /**
   * Revoke a token
   */
  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    tokens.delete(request.token);
  }
}

/**
 * Get FreeAgent access token for an MCP token
 */
export function getFreeAgentTokenForMcpToken(mcpToken: string): string | undefined {
  const tokenData = tokens.get(mcpToken);
  return tokenData?.freeagentAccessToken;
}

/**
 * Create the provider instance
 */
export function createFreeAgentOAuthProxyProvider(): FreeAgentOAuthProxyProvider {
  if (!FREEAGENT_CLIENT_ID || !FREEAGENT_CLIENT_SECRET) {
    throw new Error("FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET are required");
  }
  return new FreeAgentOAuthProxyProvider();
}
