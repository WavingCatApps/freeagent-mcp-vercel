/**
 * FreeAgent MCP Server (stdio)
 *
 * This server provides MCP tools for interacting with the FreeAgent accounting API.
 * It supports OAuth 2.0 authentication and provides access to contacts, invoices,
 * expenses, projects, bank accounts, and company information.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FreeAgentApiClient } from "./services/api-client.js";
import { registerAllTools } from "./tools/register.js";

// Get configuration from environment
const ACCESS_TOKEN = process.env.FREEAGENT_ACCESS_TOKEN;
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";

// Logging helper with timestamps
function log(level: string, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };
  console.error(JSON.stringify(logEntry));
}

async function main() {
  // Validate environment variables
  if (!ACCESS_TOKEN) {
    log("error", "FREEAGENT_ACCESS_TOKEN environment variable is required", {
      instructions: [
        "Create an app at https://dev.freeagent.com",
        "Use OAuth 2.0 to obtain an access token",
        "Set FREEAGENT_ACCESS_TOKEN environment variable",
        "Optionally set FREEAGENT_USE_SANDBOX=true for sandbox API",
      ],
      documentation: "https://dev.freeagent.com/docs/oauth",
    });
    process.exit(1);
  }

  log("info", "Starting FreeAgent MCP server", {
    environment: USE_SANDBOX ? "sandbox" : "production",
    nodeVersion: process.version,
    platform: process.platform,
  });

  // Initialize MCP server and register tools
  const server = new McpServer({
    name: "freeagent-mcp-server",
    version: "1.0.0"
  });

  const apiClient = new FreeAgentApiClient(ACCESS_TOKEN, USE_SANDBOX);
  registerAllTools(server, apiClient);

  // Create transport
  const transport = new StdioServerTransport();

  // Add error handler for transport
  process.stdin.on("error", (error) => {
    log("error", "stdin error - connection may be lost", {
      error: error.message,
      stack: error.stack,
    });
  });

  process.stdout.on("error", (error) => {
    log("error", "stdout error - connection may be lost", {
      error: error.message,
      stack: error.stack,
    });
  });

  process.stdin.on("end", () => {
    log("warn", "stdin ended - client disconnected");
  });

  process.stdin.on("close", () => {
    log("warn", "stdin closed - connection terminated");
  });

  // Monitor for unhandled errors
  process.on("uncaughtException", (error) => {
    log("error", "Uncaught exception", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, _promise) => {
    log("error", "Unhandled promise rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    log("info", "Received shutdown signal", { signal });
    try {
      // Give time for in-flight requests to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      log("info", "Server shutdown complete");
      process.exit(0);
    } catch (error) {
      log("error", "Error during shutdown", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Connect server to transport
  try {
    await server.connect(transport);
    const environment = USE_SANDBOX ? "sandbox" : "production";
    log("info", "FreeAgent MCP server connected successfully", {
      environment,
      transport: "stdio",
    });

    // Log heartbeat every 30 seconds to detect if process is alive
    const heartbeatInterval = setInterval(() => {
      log("debug", "Server heartbeat", {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });
    }, 30000);

    // Clean up heartbeat on exit
    process.on("exit", () => {
      clearInterval(heartbeatInterval);
    });

    // Warning: Log token expiration concern (tokens typically expire after 1 hour)
    log("warn", "Note: FreeAgent access tokens typically expire after 1 hour. If you experience disconnects, check token expiration.", {
      tokenLength: ACCESS_TOKEN.length,
      suggestion: "Consider implementing OAuth refresh tokens for long-running connections",
    });
  } catch (error) {
    log("error", "Failed to connect server to transport", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the server
main().catch((error) => {
  log("error", "Fatal server error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
