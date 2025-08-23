// Configuration constants for MCP server

export const ALLOWED_ORIGINS = [
  // AI platforms and development tools
  'claude.ai',
  'anthropic.com',
  'openai.com',
  'chatgpt.com',
  'platform.openai.com',
  'gemini.google.com',
  'ai.google.com',
  'ai.google.dev',
  'makersuite.google.com',
  'aistudio.google.com',
  'aws.amazon.com',
  'bedrock.aws.amazon.com',
  'console.aws.amazon.com',
  'github.com',
  'github.dev',
  'codespaces.dev',
  'vscode.dev',
  'microsoft.com',
  'visualstudio.com',
  'copilot.microsoft.com',
  'copilotstudio.microsoft.com',
  'replit.com',
  'repl.it',
  'zed.dev',
  'sourcegraph.com',
  'codeium.com',
  'windsurf.com',
  'cursor.so',
  'cursor.com',
  'localhost',
  '127.0.0.1',
];

export const LEGITIMATE_USER_AGENT_PATTERNS = [
  'claude', 'anthropic', 'openai', 'chatgpt', 'google', 'gemini',
  'aws', 'bedrock', 'copilot', 'github', 'vscode', 'microsoft',
  'replit', 'zed', 'sourcegraph', 'codeium', 'windsurf', 'cursor'
];

export const CORS_ALLOWED_ORIGINS = [
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

export const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 100, // max requests per minute per IP
  maxCacheSize: 1000, // max entries in rate limiter cache
};