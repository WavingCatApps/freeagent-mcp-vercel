import { ALLOWED_ORIGINS, LEGITIMATE_USER_AGENT_PATTERNS, CORS_ALLOWED_ORIGINS, RATE_LIMIT_CONFIG } from './config.js';

// Rate limiter using in-memory store (suitable for serverless)
const rateLimiter = new Map<string, number[]>();

export const checkRateLimit = (clientIP: string): boolean => {
  const now = Date.now();
  const { windowMs, maxRequests, maxCacheSize } = RATE_LIMIT_CONFIG;
  
  const requests = rateLimiter.get(clientIP) || [];
  
  // Clean old requests outside the window
  const validRequests = requests.filter((time: number) => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  validRequests.push(now);
  rateLimiter.set(clientIP, validRequests);
  
  // Clean up old entries to prevent memory leaks
  if (rateLimiter.size > maxCacheSize) {
    const entries = Array.from(rateLimiter.entries());
    for (const [ip, times] of entries) {
      const recentTimes = times.filter(time => now - time < windowMs);
      if (recentTimes.length === 0) {
        rateLimiter.delete(ip);
      }
    }
  }
  
  return true;
};

export const validateRequest = (req: Request): void => {
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
  
  // Check if request comes from allowed origins
  const isAllowedOrigin = ALLOWED_ORIGINS.some(domain => 
    origin.includes(domain) || 
    referer.includes(domain) || 
    host.includes(domain)
  );
  
  // Check for AI platform or development tool user agent patterns
  const userAgentLower = userAgent.toLowerCase();
  const isLegitimateUserAgent = LEGITIMATE_USER_AGENT_PATTERNS.some(pattern => 
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

export const handleCorsResponse = (request: Request, response: Response): Response => {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && CORS_ALLOWED_ORIGINS.includes(origin);
  
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  
  return response;
};

export const handleCorsPreflightRequest = (request: Request): Response => {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && CORS_ALLOWED_ORIGINS.includes(origin);
  
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
};