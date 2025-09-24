import { createMcpHandler } from 'mcp-handler';
import { registerTools } from '../lib/tools.js';

// Create MCP handler with tools - simpler working approach
const handler = createMcpHandler(
  (server: any) => {
    registerTools(server);
  }
);

// Simplified HTTP handler for MCP
const httpHandler = async (request: Request) => {
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  try {
    // Use the mcp-handler to process the request
    const response = await handler(request);

    // Add CORS headers to response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    return response;
  } catch (error) {
    const errorResponse = new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });

    return errorResponse;
  }
};

// Export HTTP handler for all methods
export { httpHandler as GET, httpHandler as POST, httpHandler as DELETE };
