import { createMcpHandler, withMcpAuth } from 'mcp-handler';
// @ts-ignore - The freeagent-mcp package doesn't have proper TypeScript declarations yet
import { FreeAgentClient } from 'freeagent-mcp/build/freeagent-client.js';
import { z } from 'zod';

// Wrapper to adapt the existing MCP server tools for Vercel
const handler = createMcpHandler(
  (server: any) => {
    // Helper function to create client with credentials from auth info or environment variables
    const createClient = (authInfo?: any) => {
      // Try to get credentials from auth info first, then fall back to environment variables
      const clientId = authInfo?.clientId || process.env.FREEAGENT_CLIENT_ID;
      const clientSecret = authInfo?.clientSecret || process.env.FREEAGENT_CLIENT_SECRET;
      const accessToken = authInfo?.accessToken || process.env.FREEAGENT_ACCESS_TOKEN;
      const refreshToken = authInfo?.refreshToken || process.env.FREEAGENT_REFRESH_TOKEN;

      if (!clientId || !clientSecret || !accessToken || !refreshToken) {
        throw new Error('Missing required FreeAgent credentials. Please provide clientId, clientSecret, accessToken, and refreshToken either through the connector UI or environment variables.');
      }

      return new FreeAgentClient({
        clientId,
        clientSecret,
        accessToken,
        refreshToken
      });
    };

    // Helper function to make direct API requests using client's axios instance
    const makeDirectRequest = async (endpoint: string, options: any = {}, authInfo?: any) => {
      const client = createClient(authInfo);
      
      const axiosOptions = {
        method: options.method || 'GET',
        url: endpoint,
        data: options.body ? JSON.parse(options.body) : undefined,
        headers: options.headers || {}
      };

      const response = await client.axiosInstance.request(axiosOptions);
      return response.data;
    };

    // Helper function to make authenticated requests using the client's axios instance
    const getResourceDetails = async (client: any, endpoint: string) => {
      try {
        let response;
        
        if (client && typeof client === 'object') {
          if (client.axiosInstance) {
            response = await client.axiosInstance.get(endpoint);
          } else if (client.axios) {
            response = await client.axios.get(endpoint);
          } else if (client.http) {
            response = await client.http.get(endpoint);
          } else if (client._axios) {
            response = await client._axios.get(endpoint);
          } else {
            // Fallback: inspect the client to find axios
            for (const [key, value] of Object.entries(client)) {
              if (value && typeof value === 'object' && 'get' in value && typeof (value as any).get === 'function') {
                response = await (value as any).get(endpoint);
                break;
              }
            }
          }
        }
        
        if (!response) {
          return null;
        }
        
        return response.data || response;
        
      } catch (error) {
        return null;
      }
    };

    // Global cache for resource details to persist across MCP requests
    const resourceCache = {
      projects: new Map(),
      tasks: new Map(), 
      users: new Map()
    };

    // Helper function to enhance timeslip data with actual resource names
    const enhanceTimeslipData = async (timeslipData: any, client: any) => {
      // Handle both array format and object with timeslips property
      const timeslips = Array.isArray(timeslipData) ? timeslipData : timeslipData?.timeslips;
      
      if (!timeslips || !Array.isArray(timeslips)) {
        return timeslipData;
      }

      const enhanced = Array.isArray(timeslipData) ? [...timeslipData] : { ...timeslipData };
      const timeslipsToProcess = Array.isArray(enhanced) ? enhanced : enhanced.timeslips;
      
      // Collect all unique IDs first to batch requests
      const projectIds = new Set();
      const taskIds = new Set();
      const userIds = new Set();
      
      timeslipsToProcess.forEach((timeslip: any) => {
        if (timeslip.project) {
          const projectId = timeslip.project.split('/').pop();
          projectIds.add(projectId);
        }
        if (timeslip.task) {
          const taskId = timeslip.task.split('/').pop();
          taskIds.add(taskId);
        }
        if (timeslip.user) {
          const userId = timeslip.user.split('/').pop();
          userIds.add(userId);
        }
      });

      // Fetch missing resource details in parallel
      const fetchPromises = [];
      
      // Fetch missing projects
      for (const projectId of projectIds) {
        if (!resourceCache.projects.has(projectId)) {
          fetchPromises.push(
            getResourceDetails(client, `/projects/${projectId}`)
              .then(data => resourceCache.projects.set(projectId, data?.project?.name || `Project ${projectId}`))
          );
        }
      }
      
      // Fetch missing tasks
      for (const taskId of taskIds) {
        if (!resourceCache.tasks.has(taskId)) {
          fetchPromises.push(
            getResourceDetails(client, `/tasks/${taskId}`)
              .then(data => resourceCache.tasks.set(taskId, data?.task?.name || `Task ${taskId}`))
          );
        }
      }
      
      // Fetch missing users
      for (const userId of userIds) {
        if (!resourceCache.users.has(userId)) {
          fetchPromises.push(
            getResourceDetails(client, `/users/${userId}`)
              .then(data => {
                const userName = data?.user ? 
                  `${data.user.first_name} ${data.user.last_name}`.trim() : 
                  `User ${userId}`;
                resourceCache.users.set(userId, userName);
              })
          );
        }
      }

      // Wait for all fetches to complete
      await Promise.all(fetchPromises);
      
      // Apply cached data to timeslips
      for (const timeslip of timeslipsToProcess) {
        if (timeslip.project) {
          const projectId = timeslip.project.split('/').pop();
          timeslip.project_id = projectId;
          timeslip.project_name = resourceCache.projects.get(projectId);
        }
        
        if (timeslip.task) {
          const taskId = timeslip.task.split('/').pop();
          timeslip.task_id = taskId;
          timeslip.task_name = resourceCache.tasks.get(taskId);
        }
        
        if (timeslip.user) {
          const userId = timeslip.user.split('/').pop();
          timeslip.user_id = userId;
          timeslip.user_name = resourceCache.users.get(userId);
        }
      }
      
      return enhanced;
    };

    // List timeslips tool
    server.tool(
      'list_timeslips',
      'List and filter timeslips from FreeAgent',
      {
        from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
        to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
        view: z.enum(['all', 'unbilled', 'running']).optional().describe('Filter view'),
        user: z.string().optional().describe('User URL to filter by'),
        project: z.string().optional().describe('Project URL to filter by'),
        task: z.string().optional().describe('Task URL to filter by'),
      },
      async (params: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          const result = await client.listTimeslips(params);
          const enhanced = await enhanceTimeslipData(result, client);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(enhanced, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // List projects tool
    server.tool(
      'list_projects',
      'List all projects in FreeAgent',
      {
        view: z.enum(['all', 'active', 'completed']).optional().describe('Filter view (default: active)')
      },
      async (params: any, { auth }: any = {}) => {
        try {
          const view = params.view || 'active';
          const result = await makeDirectRequest(`/projects?view=${view}`, {}, auth);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Create task tool
    server.tool(
      'create_task',
      'Create a new task for a project in FreeAgent',
      {
        project: z.string().describe('Project URL or ID'),
        name: z.string().describe('Task name'),
        is_recurring: z.boolean().optional().describe('Whether this is a recurring task (default: false)'),
        status: z.enum(['Active', 'Hidden', 'Completed']).optional().describe('Task status (default: Active)')
      },
      async (params: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          
          // Prepare task data with defaults
          const taskData = {
            name: params.name,
            project: params.project,
            is_billable: true, // Always set to true as requested
            is_recurring: params.is_recurring || false,
            status: params.status || 'Active'
            // Explicitly omitting billing_rate and billing_period as requested
          };

          const result = await makeDirectRequest('/tasks', {
            method: 'POST',
            body: JSON.stringify({ task: taskData })
          }, auth);

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Get single timeslip tool
    server.tool(
      'get_timeslip',
      'Get a specific timeslip by ID',
      {
        id: z.string().describe('Timeslip ID'),
      },
      async ({ id }: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          const result = await client.getTimeslip(id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Create timeslip tool
    server.tool(
      'create_timeslip',
      'Create a new timeslip in FreeAgent',
      {
        task: z.string().describe('Task URL'),
        user: z.string().describe('User URL'),
        project: z.string().describe('Project URL'),
        dated_on: z.string().describe('Date in YYYY-MM-DD format'),
        hours: z.number().describe('Number of hours'),
        comment: z.string().optional().describe('Optional comment'),
      },
      async (params: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          const result = await client.createTimeslip(params);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Update timeslip tool
    server.tool(
      'update_timeslip',
      'Update an existing timeslip in FreeAgent',
      {
        id: z.string().describe('Timeslip ID'),
        task: z.string().optional().describe('Task URL'),
        user: z.string().optional().describe('User URL'),
        project: z.string().optional().describe('Project URL'),
        dated_on: z.string().optional().describe('Date in YYYY-MM-DD format'),
        hours: z.number().optional().describe('Number of hours'),
        comment: z.string().optional().describe('Comment'),
      },
      async ({ id, ...updateData }: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          const result = await client.updateTimeslip(id, updateData);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Delete timeslip tool
    server.tool(
      'delete_timeslip',
      'Delete a timeslip from FreeAgent',
      {
        id: z.string().describe('Timeslip ID'),
      },
      async ({ id }: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          const result = await client.deleteTimeslip(id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Start timer tool
    server.tool(
      'start_timer',
      'Start a timer for a timeslip in FreeAgent',
      {
        id: z.string().describe('Timeslip ID'),
      },
      async ({ id }: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          const result = await client.startTimer(id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );

    // Stop timer tool
    server.tool(
      'stop_timer',
      'Stop a timer for a timeslip in FreeAgent',
      {
        id: z.string().describe('Timeslip ID'),
      },
      async ({ id }: any, { auth }: any = {}) => {
        try {
          const client = createClient(auth);
          const result = await client.stopTimer(id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      }
    );
  },
  {},
  { basePath: '/api' }
);

// Rate limiter using in-memory store (suitable for serverless)
const rateLimiter = new Map<string, number[]>();

const checkRateLimit = (clientIP: string): boolean => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 100; // max requests per minute per IP
  
  const requests = rateLimiter.get(clientIP) || [];
  
  // Clean old requests outside the window
  const validRequests = requests.filter((time: number) => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  validRequests.push(now);
  rateLimiter.set(clientIP, validRequests);
  
  // Clean up old entries to prevent memory leaks
  if (rateLimiter.size > 1000) {
    for (const [ip, times] of rateLimiter.entries()) {
      const recentTimes = times.filter(time => now - time < windowMs);
      if (recentTimes.length === 0) {
        rateLimiter.delete(ip);
      }
    }
  }
  
  return true;
};

const validateRequest = (req: Request): void => {
  // Get client IP
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  
  // Check rate limit first
  if (!checkRateLimit(clientIP)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  // Skip validation in development or local environments
  if (process.env.NODE_ENV !== 'production' || 
      process.env.VERCEL_ENV !== 'production') {
    return;
  }
  
  // Get request headers for validation
  const userAgent = req.headers.get('user-agent') || '';
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const host = req.headers.get('host') || '';
  
  // Allow requests from AI platforms and development tools
  const allowedOrigins = [
    // Claude/Anthropic domains
    'claude.ai',
    'anthropic.com',
    // OpenAI domains
    'openai.com',
    'chatgpt.com',
    'platform.openai.com',
    // Google AI domains
    'gemini.google.com',
    'ai.google.com',
    'ai.google.dev',
    'makersuite.google.com',
    'aistudio.google.com',
    // AWS domains
    'aws.amazon.com',
    'bedrock.aws.amazon.com',
    'console.aws.amazon.com',
    // Microsoft domains
    'github.com',
    'github.dev',
    'codespaces.dev',
    'vscode.dev',
    'microsoft.com',
    'visualstudio.com',
    'copilot.microsoft.com',
    'copilotstudio.microsoft.com',
    // Development platforms
    'replit.com',
    'repl.it',
    'zed.dev',
    'sourcegraph.com',
    'codeium.com',
    // Local testing
    'localhost',
    '127.0.0.1',
  ];
  
  // Check if request comes from allowed origins or has Claude-specific patterns
  const isAllowedOrigin = allowedOrigins.some(domain => 
    origin.includes(domain) || 
    referer.includes(domain) || 
    host.includes(domain)
  );
  
  // Check for AI platform or development tool user agent patterns
  const legitimateUserAgentPatterns = [
    'claude', 'anthropic', 'openai', 'chatgpt', 'google', 'gemini',
    'aws', 'bedrock', 'copilot', 'github', 'vscode', 'microsoft',
    'replit', 'zed', 'sourcegraph', 'codeium', 'windsurf', 'cursor'
  ];
  const userAgentLower = userAgent.toLowerCase();
  const isLegitimateUserAgent = legitimateUserAgentPatterns.some(pattern => 
    userAgentLower.includes(pattern)
  );
  
  // Check for MCP-specific headers or patterns that indicate legitimate MCP clients
  const mcpHeaders = req.headers.get('content-type')?.includes('application/json');
  const isMcpRequest = mcpHeaders && (
    userAgent.toLowerCase().includes('mcp') ||
    userAgent.toLowerCase().includes('inspector') ||
    userAgent.toLowerCase().includes('node') // Common for MCP inspector tools
  );
  
  // Allow if any of these conditions are met
  if (isAllowedOrigin || isLegitimateUserAgent || isMcpRequest) {
    return;
  }
  
  // Log suspicious requests for monitoring
  console.warn('Blocked request:', {
    ip: clientIP,
    userAgent,
    origin,
    referer,
    host,
    timestamp: new Date().toISOString()
  });
  
  throw new Error('Unauthorized request source');
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

// Dynamic CORS handler for multiple legitimate origins
const corsHandler = async (request: Request) => {
  // Optional URL suffix validation for additional security
  const expectedSuffix = process.env.ENDPOINT_PATH_SUFFIX;
  if (expectedSuffix && !request.url.includes(expectedSuffix)) {
    return new Response('Not Found', { status: 404 });
  }

  const origin = request.headers.get('origin');
  const allowedOrigins = [
    // Claude/Anthropic
    'https://claude.ai',
    'https://www.claude.ai',
    'https://anthropic.com',
    // OpenAI
    'https://openai.com',
    'https://chatgpt.com',
    'https://platform.openai.com',
    // Google AI
    'https://gemini.google.com',
    'https://ai.google.com',
    'https://ai.google.dev',
    'https://makersuite.google.com',
    'https://aistudio.google.com',
    // AWS
    'https://aws.amazon.com',
    'https://bedrock.aws.amazon.com',
    'https://console.aws.amazon.com',
    // Microsoft
    'https://github.com',
    'https://github.dev',
    'https://vscode.dev',
    'https://codespaces.dev',
    'https://microsoft.com',
    'https://copilot.microsoft.com',
    'https://copilotstudio.microsoft.com',
    // Development platforms
    'https://replit.com',
    'https://repl.it',
    'https://zed.dev',
    'https://sourcegraph.com',
    'https://codeium.com',
    'https://windsurf.com',
    'https://cursor.so',
    'https://cursor.com',
    // Local testing
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
  ];

  // Check if origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    // Call the original auth handler
    const response = await authHandler(request);
    
    // Add CORS headers to the response
    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    }
    
    return response;
  } catch (error) {
    // Handle errors with CORS headers
    const errorResponse = new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
      },
    });
    
    return errorResponse;
  }
};

// Wrap the handler with auth middleware
const authHandler = withMcpAuth(handler, verifyToken, { required: false });

export { corsHandler as GET, corsHandler as POST, corsHandler as DELETE };
