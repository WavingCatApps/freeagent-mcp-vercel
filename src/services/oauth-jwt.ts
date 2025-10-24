/**
 * Stateless JWT-Based OAuth Provider for FreeAgent
 *
 * Instead of storing token mappings in a database, we encode the FreeAgent
 * token directly into a signed JWT. This makes the solution completely stateless
 * and perfect for serverless environments.
 *
 * Flow:
 * 1. User authorizes → Get FreeAgent access/refresh tokens
 * 2. Encode FreeAgent tokens into a signed JWT
 * 3. Return JWT as the MCP access token
 * 4. On each request: Verify JWT signature → Extract FreeAgent token
 */

import jwt from "jsonwebtoken";
import express from "express";
import { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import crypto from "crypto";

// Configuration
const FREEAGENT_CLIENT_ID = process.env.FREEAGENT_CLIENT_ID!;
const FREEAGENT_CLIENT_SECRET = process.env.FREEAGENT_CLIENT_SECRET!;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";

// Determine base URL
// IMPORTANT: Set PRODUCTION_URL in Vercel environment variables to use a stable URL
// Example: PRODUCTION_URL=freeagent-mcp-vercel-simonrices-projects.vercel.app
// This ensures OAuth callbacks use a consistent URL instead of per-deployment URLs
const PRODUCTION_URL = process.env.PRODUCTION_URL;
const VERCEL_BRANCH_URL = process.env.VERCEL_BRANCH_URL;
const VERCEL_URL = process.env.VERCEL_URL;

const BASE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : (VERCEL_BRANCH_URL
    ? `https://${VERCEL_BRANCH_URL}`
    : (VERCEL_URL ? `https://${VERCEL_URL}` : (process.env.BASE_URL || "http://localhost:3000")));

const FREEAGENT_BASE = USE_SANDBOX
  ? "https://api.sandbox.freeagent.com"
  : "https://api.freeagent.com";

// JWT payload structure
interface JWTPayload {
  freeagentAccessToken: string;
  freeagentRefreshToken: string;
  clientId: string;
  scopes: string[];
  iat: number;
  exp: number;
}

// In-memory storage only for auth codes (short-lived, cleaned up after exchange)
interface AuthCodeData {
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
  state?: string;
  freeagentCode?: string;
}

const authCodes = new Map<string, AuthCodeData>();
const clients = new Map<string, OAuthClientInformationFull>();

/**
 * Client store for dynamic registration
 */
class JWTClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    return clients.get(clientId);
  }

  async registerClient(clientMetadata: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
    clients.set(clientMetadata.client_id, clientMetadata);
    return clientMetadata;
  }
}

/**
 * JWT-based OAuth Provider (Stateless)
 */
export class FreeAgentJWTOAuthProvider implements OAuthServerProvider {
  clientsStore: OAuthRegisteredClientsStore;

  constructor() {
    this.clientsStore = new JWTClientsStore();

    if (!JWT_SECRET) {
      console.warn("WARNING: JWT_SECRET not set. Using random secret (tokens won't persist across restarts)");
    }
  }

  /**
   * Redirect to FreeAgent for authorization
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: any
  ): Promise<void> {
    try {
      const ourAuthCode = crypto.randomBytes(32).toString('base64url');

      authCodes.set(ourAuthCode, {
        codeChallenge: params.codeChallenge,
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        state: params.state,
      });

      const freeagentAuthUrl = new URL(`${FREEAGENT_BASE}/v2/approve_app`);
      freeagentAuthUrl.searchParams.set("client_id", FREEAGENT_CLIENT_ID);
      freeagentAuthUrl.searchParams.set("response_type", "code");
      freeagentAuthUrl.searchParams.set("redirect_uri", `${BASE_URL}/oauth/callback`);
      freeagentAuthUrl.searchParams.set("state", ourAuthCode);

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
   * Handle FreeAgent callback
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

    authData.freeagentCode = freeagentCode;
    authCodes.set(ourAuthCode, authData);

    return {
      redirectUri: authData.redirectUri,
      code: ourAuthCode,
      state: authData.state,
    };
  }

  /**
   * PKCE challenge
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
   * Exchange authorization code for JWT-based access token
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
      // Exchange FreeAgent code for tokens
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

      // Create JWT payload with FreeAgent tokens
      const payload: JWTPayload = {
        freeagentAccessToken: freeagentTokens.access_token,
        freeagentRefreshToken: freeagentTokens.refresh_token,
        clientId: client.client_id,
        scopes: ["freeagent"],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (freeagentTokens.expires_in || 3600),
      };

      // Sign the JWT
      const mcpAccessToken = jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
      });

      // Create refresh token (also a JWT)
      const refreshPayload = {
        freeagentRefreshToken: freeagentTokens.refresh_token,
        clientId: client.client_id,
        type: 'refresh',
      };
      const mcpRefreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '30d', // Refresh tokens last longer
      });

      // Clean up auth code (no longer needed)
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
    try {
      // Verify and decode the refresh token JWT
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;

      if (decoded.type !== 'refresh' || decoded.clientId !== client.client_id) {
        throw new Error("Invalid refresh token");
      }

      // Use FreeAgent refresh token to get new FreeAgent tokens
      const tokenResponse = await fetch(`${FREEAGENT_BASE}/v2/token_endpoint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${FREEAGENT_CLIENT_ID}:${FREEAGENT_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: decoded.freeagentRefreshToken,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("FreeAgent refresh failed");
      }

      const freeagentTokens = await tokenResponse.json();

      // Create new JWT with new FreeAgent tokens
      const payload: JWTPayload = {
        freeagentAccessToken: freeagentTokens.access_token,
        freeagentRefreshToken: freeagentTokens.refresh_token,
        clientId: client.client_id,
        scopes: ["freeagent"],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (freeagentTokens.expires_in || 3600),
      };

      const newMcpAccessToken = jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
      });

      return {
        access_token: newMcpAccessToken,
        token_type: "bearer",
        expires_in: freeagentTokens.expires_in || 3600,
        refresh_token: refreshToken, // Same refresh token can be reused
      };
    } catch (error) {
      throw new Error(`Refresh token exchange failed: ${error}`);
    }
  }

  /**
   * Verify JWT and return auth info
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      return {
        token,
        clientId: decoded.clientId,
        scopes: decoded.scopes,
        expiresAt: decoded.exp,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Access token expired");
      }
      throw new Error("Invalid access token");
    }
  }

  /**
   * Revoke token (JWT is stateless, so we can't revoke, but we fulfill the interface)
   */
  async revokeToken(
    _client: OAuthClientInformationFull,
    _request: OAuthTokenRevocationRequest
  ): Promise<void> {
    // JWTs are stateless - once issued, they're valid until expiration
    // In a production system, you might maintain a revocation list in Redis
    // For now, we just acknowledge the revocation request
    return;
  }
}

/**
 * Extract FreeAgent token from MCP JWT
 */
export function getFreeAgentTokenFromJWT(mcpToken: string): string | undefined {
  try {
    const decoded = jwt.verify(mcpToken, JWT_SECRET) as JWTPayload;
    return decoded.freeagentAccessToken;
  } catch (error) {
    return undefined;
  }
}

/**
 * Create the provider instance
 */
export function createFreeAgentJWTOAuthProvider(): FreeAgentJWTOAuthProvider {
  if (!FREEAGENT_CLIENT_ID || !FREEAGENT_CLIENT_SECRET) {
    throw new Error("FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET are required");
  }
  return new FreeAgentJWTOAuthProvider();
}
