// Configuration constants for MCP server

// Platform configuration with domains and user agent patterns
const PLATFORM_CONFIG = {
  // AI Platforms
  claude: {
    domains: ['claude.ai', 'anthropic.com'],
    userAgentPatterns: ['claude', 'anthropic'],
  },
  openai: {
    domains: ['openai.com', 'chatgpt.com', 'platform.openai.com'],
    userAgentPatterns: ['openai', 'chatgpt'],
  },
  google: {
    domains: ['gemini.google.com', 'ai.google.com', 'ai.google.dev', 'makersuite.google.com', 'aistudio.google.com'],
    userAgentPatterns: ['google', 'gemini'],
  },
  aws: {
    domains: ['aws.amazon.com', 'bedrock.aws.amazon.com', 'console.aws.amazon.com'],
    userAgentPatterns: ['aws', 'bedrock'],
  },
  // Microsoft Ecosystem
  microsoft: {
    domains: ['github.com', 'github.dev', 'codespaces.dev', 'vscode.dev', 'microsoft.com', 'visualstudio.com', 'copilot.microsoft.com', 'copilotstudio.microsoft.com'],
    userAgentPatterns: ['copilot', 'github', 'vscode', 'microsoft'],
  },
  // Development Tools
  replit: {
    domains: ['replit.com', 'repl.it'],
    userAgentPatterns: ['replit'],
  },
  zed: {
    domains: ['zed.dev'],
    userAgentPatterns: ['zed'],
  },
  sourcegraph: {
    domains: ['sourcegraph.com'],
    userAgentPatterns: ['sourcegraph'],
  },
  windsurf: {
    domains: ['codeium.com', 'windsurf.com'],
    userAgentPatterns: ['codeium', 'windsurf'],
  },
  cursor: {
    domains: ['cursor.so', 'cursor.com'],
    userAgentPatterns: ['cursor'],
  },
};

// Extract all domains from platform config
const BASE_DOMAINS = [
  ...Object.values(PLATFORM_CONFIG).flatMap(platform => platform.domains),
  'localhost',
  '127.0.0.1',
];

// For request validation (domain matching)
export const ALLOWED_ORIGINS = BASE_DOMAINS;

// For CORS headers (full URLs)
export const CORS_ALLOWED_ORIGINS = [
  // Production domains
  ...BASE_DOMAINS
    .filter(domain => !['localhost', '127.0.0.1'].includes(domain))
    .map(domain => `https://${domain}`),
  // Add www variant for claude.ai
  'https://www.claude.ai',
  // Local testing
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
];

// Extract all user agent patterns from platform config
export const LEGITIMATE_USER_AGENT_PATTERNS = Object.values(PLATFORM_CONFIG).flatMap(platform => platform.userAgentPatterns);

export const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 100, // max requests per minute per IP
  maxCacheSize: 1000, // max entries in rate limiter cache
};