import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { validateRequest, handleCorsPreflightRequest, handleCorsResponse } from '../lib/security.js';
import { registerTools } from '../lib/tools.js';

const adaptChatGptActionRequest = async (request: Request): Promise<Request> => {
  if (request.method !== 'POST') {
    return request;
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('application/json')) {
    return request;
  }

  let rawBodyText: string;
  try {
    rawBodyText = await request.clone().text();
  } catch {
    return request;
  }

  const trimmedBodyText = rawBodyText.trim();
  if (!trimmedBodyText) {
    return request;
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(trimmedBodyText);
  } catch {
    return request;
  }

  if (!parsedBody || typeof parsedBody !== 'object') {
    return request;
  }

  const bodyAsRecord = parsedBody as Record<string, unknown>;
  if (typeof bodyAsRecord.path !== 'string') {
    return request;
  }

  const { path, args, id } = bodyAsRecord;

  let parsedArgs: unknown = args;
  if (typeof parsedArgs === 'string') {
    const argText = parsedArgs.trim();
    if (!argText) {
      parsedArgs = {};
    } else {
      try {
        parsedArgs = JSON.parse(argText);
      } catch {
        parsedArgs = { value: parsedArgs };
      }
    }
  }

  if (parsedArgs === undefined || parsedArgs === null) {
    parsedArgs = {};
  }

  const jsonRpcPayload = {
    jsonrpc: '2.0' as const,
    id: typeof id === 'string' || typeof id === 'number' ? id : `chatgpt-${Date.now()}`,
    method: 'tools/call' as const,
    params: {
      name: path,
      arguments: typeof parsedArgs === 'object' && parsedArgs !== null ? parsedArgs : { value: parsedArgs },
    },
  };

  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');

  return new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(jsonRpcPayload),
  });
};

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
    const normalizedRequest = await adaptChatGptActionRequest(request);
    // Call the original auth handler
    const response = await authHandler(normalizedRequest);
    
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
