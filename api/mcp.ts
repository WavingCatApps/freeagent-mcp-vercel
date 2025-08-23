import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { validateRequest, handleCorsPreflightRequest, handleCorsResponse } from '../lib/security.js';
import { registerTools } from '../lib/tools.js';

// Custom auth verification function that extracts credentials from Bearer token
const verifyToken = async (req: Request, bearerToken?: string) => {
  // Validate request first
  try {
    validateRequest(req);
  } catch (error) {
    throw error; // Re-throw validation errors
  }
  
  if (!bearerToken) {
    return undefined; // Allow fallback to environment variables
  }

  try {
    // Expect Bearer token to be a JSON object with credentials
    const credentials = JSON.parse(atob(bearerToken));
    
    // Validate that we have the required credentials
    if (credentials.clientId && credentials.clientSecret && credentials.accessToken && credentials.refreshToken) {
      return credentials;
    }
    
    return undefined;
  } catch (error) {
    // If parsing fails, allow fallback to environment variables
    return undefined;
  }
};

// Create MCP handler with tools
const handler = createMcpHandler(
  (server: any) => {
    registerTools(server);
  },
  {},
  { basePath: '/api' }
);

// Dynamic CORS handler for multiple legitimate origins
const corsHandler = async (request: Request) => {
  // Optional URL suffix validation for additional security
  const expectedSuffix = process.env.ENDPOINT_PATH_SUFFIX;
  if (expectedSuffix && !request.url.includes(expectedSuffix)) {
    return new Response('Not Found', { status: 404 });
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return handleCorsPreflightRequest(request);
  }

  try {
    // Call the original auth handler
    const response = await authHandler(request);
    
    // Add CORS headers to the response
    return handleCorsResponse(request, response);
  } catch (error) {
    // Handle errors with CORS headers
    const errorResponse = new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return handleCorsResponse(request, errorResponse);
  }
};

// Wrap the handler with auth middleware
const authHandler = withMcpAuth(handler, verifyToken, { required: false });

export { corsHandler as GET, corsHandler as POST, corsHandler as DELETE };