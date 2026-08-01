/**
 * Stateless JWT-Based OAuth Provider for FreeAgent
 *
 * Instead of storing token mappings or auth codes in memory/database, we encode
 * state into signed JWTs. This is required on Vercel: serverless instances do not
 * share memory, so an in-memory auth-code Map causes /oauth/callback to 500 with
 * "Invalid authorization code" whenever authorize and callback hit different instances.
 *
 * Flow:
 * 1. /authorize → signed auth_req JWT (FreeAgent `state`)
 * 2. /oauth/callback → signed auth_code JWT (returned to the MCP client)
 * 3. /token → verify auth_code JWT, exchange FreeAgent code, issue MCP access JWT
 * 4. On each MCP request: verify access JWT → extract FreeAgent token
 */

import jwt from "jsonwebtoken";
import { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import crypto from "crypto";
import type { Response } from "express";
import { getBaseUrl, getRequestBaseUrl } from "../constants.js";

// Configuration
const FREEAGENT_CLIENT_ID = process.env.FREEAGENT_CLIENT_ID!;
const FREEAGENT_CLIENT_SECRET = process.env.FREEAGENT_CLIENT_SECRET!;
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";

// Short-lived OAuth handshake JWTs (authorize → callback → token exchange)
const AUTH_CODE_EXPIRY: jwt.SignOptions["expiresIn"] = "10m";

/**
 * Resolve the JWT signing secret.
 * On Vercel a stable JWT_SECRET is mandatory — a per-instance random secret breaks
 * both OAuth auth codes and access-token verification across cold starts.
 */
export function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error(
      "JWT_SECRET environment variable is required on Vercel. " +
        "Without a stable secret, OAuth cannot complete across serverless instances."
    );
  }
  console.warn(
    "WARNING: JWT_SECRET not set. Using random secret (tokens won't persist across restarts)"
  );
  return crypto.randomBytes(32).toString("hex");
}

const JWT_SECRET = resolveJwtSecret();

// Testing: Override token expiry for testing OAuth refresh
// Set MCP_TOKEN_EXPIRY_SECONDS=60 to test 1-minute expiry
const MCP_TOKEN_EXPIRY_SECONDS = process.env.MCP_TOKEN_EXPIRY_SECONDS
  ? parseInt(process.env.MCP_TOKEN_EXPIRY_SECONDS, 10)
  : undefined; // undefined = use FreeAgent's expires_in

// Fallback refresh token lifetime if FreeAgent doesn't provide refresh_token_expires_in
// FreeAgent typically returns ~20 years, so this fallback should rarely be needed
const MCP_REFRESH_TOKEN_EXPIRY_FALLBACK = (process.env.MCP_REFRESH_TOKEN_EXPIRY || '90d') as import('ms').StringValue;

const BASE_URL = getBaseUrl();

const FREEAGENT_BASE = USE_SANDBOX
  ? "https://api.sandbox.freeagent.com"
  : "https://api.freeagent.com";

// JWT payload structure for MCP access tokens
interface JWTPayload {
  freeagentAccessToken: string;
  freeagentRefreshToken: string;
  clientId: string;
  scopes: string[];
  iat: number;
  exp: number;
}

/** Signed into FreeAgent's `state` during /authorize */
export interface AuthRequestPayload {
  typ: "auth_req";
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
  /** Public origin used as FreeAgent redirect_uri (must match at /token exchange) */
  serverBaseUrl: string;
  state?: string;
}

/** Signed authorization code returned to the MCP client after FreeAgent callback */
export interface AuthCodePayload {
  typ: "auth_code";
  codeChallenge: string;
  clientId: string;
  redirectUri: string;
  /** Public origin used as FreeAgent redirect_uri (must match authorize) */
  serverBaseUrl: string;
  state?: string;
  freeagentCode: string;
}

const clients = new Map<string, OAuthClientInformationFull>();

function signAuthJwt(payload: AuthRequestPayload | AuthCodePayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: AUTH_CODE_EXPIRY,
  });
}

function verifyAuthRequest(token: string): AuthRequestPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as AuthRequestPayload;
  if (decoded.typ !== "auth_req") {
    throw new Error("Invalid authorization code");
  }
  return decoded;
}

function verifyAuthCode(token: string): AuthCodePayload {
  const decoded = jwt.verify(token, JWT_SECRET) as AuthCodePayload;
  if (decoded.typ !== "auth_code") {
    throw new Error("Invalid authorization code");
  }
  return decoded;
}

/**
 * Client store for dynamic registration
 * Handles serverless cold starts by allowing "lost" clients to be reconstructed
 */
class JWTClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const existingClient = clients.get(clientId);
    if (existingClient) {
      return existingClient;
    }

    // If client not found in memory (serverless cold start), create a placeholder
    // The real validation happens in exchangeRefreshToken via the JWT
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      component: "client-store",
      message: "Client not in memory (cold start), creating placeholder for refresh validation",
      data: { clientId }
    }));

    // Return a minimal valid client that will pass SDK validation
    // The refresh token JWT contains the full client metadata anyway
    const placeholderClient: OAuthClientInformationFull = {
      client_id: clientId,
      client_name: "Claude Desktop (Recovered)",
      redirect_uris: [],
      grant_types: ["refresh_token", "authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };

    // Re-register it so future requests in this instance don't need reconstruction
    clients.set(clientId, placeholderClient);
    return placeholderClient;
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
  }

  /**
   * Redirect to FreeAgent for authorization.
   * PKCE + client redirect state are encoded in a signed JWT passed as FreeAgent `state`,
   * so the handshake survives serverless instance hops.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    try {
      // Prefer the Host the MCP client actually hit (e.g. per-deploy URL) so
      // FreeAgent redirect_uri can match project-scoped alphanumeric wildcards.
      const serverBaseUrl =
        (res.req ? getRequestBaseUrl(res.req) : undefined) || getBaseUrl();

      const authRequest: AuthRequestPayload = {
        typ: "auth_req",
        codeChallenge: params.codeChallenge,
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        serverBaseUrl,
        state: params.state,
      };
      const authRequestJwt = signAuthJwt(authRequest);

      const freeagentAuthUrl = new URL(`${FREEAGENT_BASE}/v2/approve_app`);
      freeagentAuthUrl.searchParams.set("client_id", FREEAGENT_CLIENT_ID);
      freeagentAuthUrl.searchParams.set("response_type", "code");
      freeagentAuthUrl.searchParams.set("redirect_uri", `${serverBaseUrl}/oauth/callback`);
      freeagentAuthUrl.searchParams.set("state", authRequestJwt);

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
   * Handle FreeAgent callback.
   * Verifies the auth_req JWT from `state` and issues a signed auth_code JWT that
   * embeds the FreeAgent authorization code for the subsequent /token exchange.
   */
  async handleFreeAgentCallback(authRequestJwt: string, freeagentCode: string): Promise<{
    redirectUri: string;
    code: string;
    state?: string;
  }> {
    let authRequest: AuthRequestPayload;
    try {
      authRequest = verifyAuthRequest(authRequestJwt);
    } catch {
      throw new Error("Invalid authorization code");
    }

    const authCode: AuthCodePayload = {
      typ: "auth_code",
      codeChallenge: authRequest.codeChallenge,
      clientId: authRequest.clientId,
      redirectUri: authRequest.redirectUri,
      serverBaseUrl: authRequest.serverBaseUrl || BASE_URL,
      state: authRequest.state,
      freeagentCode,
    };

    return {
      redirectUri: authRequest.redirectUri,
      code: signAuthJwt(authCode),
      state: authRequest.state,
    };
  }

  /**
   * PKCE challenge — read from the signed auth_code JWT (no shared memory required).
   */
  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    try {
      return verifyAuthCode(authorizationCode).codeChallenge;
    } catch {
      throw new Error("Invalid authorization code");
    }
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
    let authCode: AuthCodePayload;
    try {
      authCode = verifyAuthCode(authorizationCode);
    } catch {
      throw new Error("Invalid or expired authorization code");
    }

    if (authCode.clientId !== client.client_id) {
      throw new Error("Invalid or expired authorization code");
    }

    // Must match the redirect_uri used at authorize (stored in the auth-code JWT)
    const freeagentRedirectUri = `${authCode.serverBaseUrl || BASE_URL}/oauth/callback`;

    // Exchange FreeAgent code for tokens
    const tokenResponse = await fetch(`${FREEAGENT_BASE}/v2/token_endpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${FREEAGENT_CLIENT_ID}:${FREEAGENT_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode.freeagentCode,
        redirect_uri: freeagentRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`FreeAgent token exchange failed: ${error}`);
    }

    const freeagentTokens = await tokenResponse.json();

    // Create JWT payload with FreeAgent tokens
    const now = Math.floor(Date.now() / 1000);
    // Use override for testing, otherwise use FreeAgent's expires_in
    const expiresIn = MCP_TOKEN_EXPIRY_SECONDS ?? (freeagentTokens.expires_in || 3600);
    const expiresAt = now + expiresIn;

    const payload: JWTPayload = {
      freeagentAccessToken: freeagentTokens.access_token,
      freeagentRefreshToken: freeagentTokens.refresh_token,
      clientId: client.client_id,
      scopes: ["freeagent"],
      iat: now,
      exp: expiresAt,
    };

    // Sign the JWT
    const mcpAccessToken = jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
    });

    // Create refresh token (also a JWT)
    // IMPORTANT: Embed full client metadata to survive serverless cold starts
    const refreshPayload = {
      freeagentRefreshToken: freeagentTokens.refresh_token,
      clientId: client.client_id,
      type: 'refresh',
      // Store full client info so we can reconstruct it after cold start
      clientMetadata: {
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types,
        response_types: client.response_types,
        token_endpoint_auth_method: client.token_endpoint_auth_method,
      },
    };
    // Use FreeAgent's refresh_token_expires_in (in seconds) if provided,
    // otherwise fall back to our configured default
    const refreshExpiresIn = freeagentTokens.refresh_token_expires_in
      ? freeagentTokens.refresh_token_expires_in
      : MCP_REFRESH_TOKEN_EXPIRY_FALLBACK;
    const mcpRefreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: refreshExpiresIn,
    });

    // Log token creation (simplified)
    if (MCP_TOKEN_EXPIRY_SECONDS !== undefined) {
      // Only log in test mode
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        component: "oauth-token-exchange",
        message: "MCP tokens created (test mode)",
        data: {
          testExpiresIn: expiresIn,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
        }
      }));
    }

    return {
      access_token: mcpAccessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      refresh_token: mcpRefreshToken,
    };
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
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as JWTPayload & {
        type: string;
        clientMetadata?: OAuthClientInformationFull;
      };

      if (decoded.type !== 'refresh') {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          component: "oauth-refresh",
          message: "Invalid refresh token type",
          data: {
            expectedType: "refresh",
            actualType: decoded.type,
          }
        }));
        throw new Error("Invalid refresh token");
      }

      // Validate client_id matches (with flexibility for cold starts)
      if (decoded.clientId !== client.client_id) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          component: "oauth-refresh",
          message: "Client ID mismatch",
          data: {
            expectedClientId: client.client_id,
            actualClientId: decoded.clientId,
            hasClientMetadata: !!decoded.clientMetadata,
          }
        }));
        throw new Error("Invalid refresh token - client mismatch");
      }

      // If client was reconstructed as placeholder, restore real metadata from JWT
      if (client.client_name === "Claude Desktop (Recovered)" && decoded.clientMetadata) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          component: "oauth-refresh",
          message: "Restored client metadata from refresh token JWT",
          data: {
            clientId: decoded.clientId,
          }
        }));
        // Update the in-memory client with real metadata
        const restoredClient: OAuthClientInformationFull = decoded.clientMetadata;
        clients.set(restoredClient.client_id, restoredClient);
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
        const errorText = await tokenResponse.text();
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          component: "oauth-refresh",
          message: "FreeAgent token refresh failed",
          data: {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            error: errorText,
          }
        }));
        throw new Error(`FreeAgent refresh failed: ${tokenResponse.status} ${errorText}`);
      }

      const freeagentTokens = await tokenResponse.json();

      // Create new JWT with new FreeAgent tokens
      const now = Math.floor(Date.now() / 1000);
      // Use override for testing, otherwise use FreeAgent's expires_in
      const expiresIn = MCP_TOKEN_EXPIRY_SECONDS ?? (freeagentTokens.expires_in || 3600);
      const expiresAt = now + expiresIn;

      const payload: JWTPayload = {
        freeagentAccessToken: freeagentTokens.access_token,
        freeagentRefreshToken: freeagentTokens.refresh_token,
        clientId: client.client_id,
        scopes: ["freeagent"],
        iat: now,
        exp: expiresAt,
      };

      const newMcpAccessToken = jwt.sign(payload, JWT_SECRET, {
        algorithm: 'HS256',
      });

      // Rolling refresh: issue a new refresh token with a fresh expiry window
      // based on FreeAgent's refresh_token_expires_in (typically ~20 years).
      // This means our MCP refresh token mirrors FreeAgent's actual expiry,
      // so users only re-authenticate when FreeAgent itself requires it.
      const newRefreshPayload = {
        freeagentRefreshToken: freeagentTokens.refresh_token,
        clientId: client.client_id,
        type: 'refresh',
        clientMetadata: {
          client_id: client.client_id,
          client_name: client.client_name,
          redirect_uris: client.redirect_uris,
          grant_types: client.grant_types,
          response_types: client.response_types,
          token_endpoint_auth_method: client.token_endpoint_auth_method,
        },
      };
      const refreshExpiresIn = freeagentTokens.refresh_token_expires_in
        ? freeagentTokens.refresh_token_expires_in
        : MCP_REFRESH_TOKEN_EXPIRY_FALLBACK;
      const newMcpRefreshToken = jwt.sign(newRefreshPayload, JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: refreshExpiresIn,
      });

      // Log successful refresh (simplified)
      if (MCP_TOKEN_EXPIRY_SECONDS !== undefined) {
        // Only log details in test mode
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          component: "oauth-refresh",
          message: "Token refresh successful (test mode)",
          data: {
            testExpiresIn: expiresIn,
            expiresAt: new Date(expiresAt * 1000).toISOString(),
          }
        }));
      }

      return {
        access_token: newMcpAccessToken,
        token_type: "bearer",
        expires_in: expiresIn,
        refresh_token: newMcpRefreshToken, // Rolling refresh: fresh token with new expiry
      };
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        component: "oauth-refresh",
        message: "Token refresh failed",
        data: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      }));
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
        console.error("Access token expired");
        throw new Error("Access token expired");
      }
      console.error("Invalid access token:", error);
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
  } catch {
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
