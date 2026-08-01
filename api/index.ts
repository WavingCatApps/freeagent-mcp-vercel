/**
 * FreeAgent MCP Server with Full OAuth Proxy
 *
 * This server acts as a complete OAuth Authorization Server that proxies to FreeAgent:
 * 1. Claude connects and discovers OAuth endpoints
 * 2. Users are redirected to FreeAgent for login
 * 3. FreeAgent redirects back with auth code
 * 4. We exchange for FreeAgent tokens and issue MCP tokens
 * 5. MCP tokens are mapped to FreeAgent tokens for API calls
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createFreeAgentJWTOAuthProvider, getFreeAgentTokenFromJWT } from "../src/services/oauth-jwt.js";
import { FreeAgentApiClient } from "../src/services/api-client.js";
import { getBaseUrl, getRequestBaseUrl } from "../src/constants.js";
import { registerAllTools } from "../src/tools/register.js";

// Configuration
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";

const BASE_URL = getBaseUrl();

// Create Express app
const app = express();

// Enable trust proxy for Vercel (required for X-Forwarded-For / Host headers)
// Vercel is 1 proxy hop away, so we trust the first proxy
app.set('trust proxy', 1);

app.use(express.json());

// Create JWT-based OAuth provider (stateless)
const oauthProvider = createFreeAgentJWTOAuthProvider();

function publicOrigin(req: express.Request): string {
  return getRequestBaseUrl(req) || BASE_URL;
}

/**
 * Advertise OAuth metadata for the host the client actually requested.
 * The MCP SDK router bakes issuer/baseUrl in at startup; without this,
 * preview deploys always point FreeAgent at VERCEL_BRANCH_URL / PRODUCTION_URL
 * even when the MCP client is configured with a short per-deploy URL.
 */
app.get("/.well-known/oauth-authorization-server", (req, res) => {
  const origin = publicOrigin(req);
  res.json({
    issuer: `${origin}/`,
    service_documentation: "https://dev.freeagent.com/docs/oauth",
    authorization_endpoint: `${origin}/authorize`,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint: `${origin}/token`,
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: ["freeagent"],
    revocation_endpoint: `${origin}/revoke`,
    revocation_endpoint_auth_methods_supported: ["client_secret_post"],
    registration_endpoint: `${origin}/register`,
  });
});

app.get("/.well-known/oauth-protected-resource", (req, res) => {
  const origin = publicOrigin(req);
  res.json({
    resource: `${origin}/`,
    authorization_servers: [`${origin}/`],
    scopes_supported: ["freeagent"],
    resource_name: "FreeAgent MCP Server",
    resource_documentation: "https://dev.freeagent.com/docs/oauth",
  });
});

// Add error logging for OAuth token endpoint
app.use((req: any, res: any, next: any) => {
  if (req.path === '/token') {
    const originalJson = res.json.bind(res);

    // Only log errors, not successful requests
    res.json = function(body: any) {
      if (body.error) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          component: "oauth-token-error",
          message: "Token endpoint error",
          data: {
            grantType: req.body?.grant_type,
            error: body.error,
            errorDescription: body.error_description,
          }
        }));
      }
      return originalJson(body);
    };
  }
  next();
});

// Install full OAuth router (provides /authorize, /token, /register, etc.)
// Issuer/baseUrl here are fallbacks; well-known routes above are request-host aware.
app.use(mcpAuthRouter({
  provider: oauthProvider,
  issuerUrl: new URL(BASE_URL),
  baseUrl: new URL(BASE_URL),
  serviceDocumentationUrl: new URL("https://dev.freeagent.com/docs/oauth"),
  scopesSupported: ["freeagent"],
  resourceName: "FreeAgent MCP Server",
  resourceServerUrl: new URL(BASE_URL),
}));

// OAuth callback handler (receives redirect from FreeAgent)
app.get("/oauth/callback", async (req: any, res: any) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send(`FreeAgent authorization failed: ${error}`);
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.status(400).send("Invalid callback parameters");
    }

    // Handle the FreeAgent callback
    const result = await oauthProvider.handleFreeAgentCallback(state, code);

    // Redirect back to Claude with our authorization code
    const redirectUrl = new URL(result.redirectUri);
    redirectUrl.searchParams.set("code", result.code);
    if (result.state) {
      redirectUrl.searchParams.set("state", result.state);
    }

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send(`Callback error: ${error}`);
  }
});

// Create MCP server with tools
function createMcpServer(freeagentToken: string): McpServer {
  const server = new McpServer({
    name: "freeagent-mcp-server",
    version: "1.0.0"
  });

  const apiClient = new FreeAgentApiClient(freeagentToken, USE_SANDBOX);
  registerAllTools(server, apiClient);

  return server;
}

async function handleMcpRequest(req: any, res: any) {
  try {
    const mcpToken = req.headers.authorization?.replace("Bearer ", "");
    if (!mcpToken) {
      return res.status(401).json({ error: "No authorization token" });
    }

    const freeagentToken = getFreeAgentTokenFromJWT(mcpToken);
    if (!freeagentToken) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const server = createMcpServer(freeagentToken);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode - no sessions needed for serverless
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP endpoint error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

// MCP endpoints - POST for tool calls, GET for SSE stream, DELETE returns 405 (stateless)
// Bearer auth is applied per-request so WWW-Authenticate resource_metadata uses request host.
for (const path of ["/mcp", "/"]) {
  app.post(path, (req, res, next) => {
    requireBearerAuth({
      verifier: oauthProvider,
      resourceMetadataUrl: `${publicOrigin(req)}/.well-known/oauth-protected-resource`,
    })(req, res, next);
  }, handleMcpRequest);
  app.get(path, (req, res, next) => {
    requireBearerAuth({
      verifier: oauthProvider,
      resourceMetadataUrl: `${publicOrigin(req)}/.well-known/oauth-protected-resource`,
    })(req, res, next);
  }, handleMcpRequest);
  app.delete(path, (_req: any, res: any) => {
    res.status(405).json({ error: "Method not allowed - server is stateless, no sessions to terminate" });
  });
}

// Health check
app.get("/health", (req: any, res: any) => {
  res.json({
    status: "ok",
    service: "freeagent-mcp-server",
    version: "1.0.0",
    oauth_mode: "jwt-stateless",
    freeagent_environment: USE_SANDBOX ? "sandbox" : "production",
  });
});

export default app;
