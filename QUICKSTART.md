# FreeAgent MCP Server - Quick Setup Guide

## Prerequisites

- A [Vercel account](https://vercel.com/signup)
- A FreeAgent account (or [create a sandbox account](https://dev.freeagent.com/docs/quick_start))
- A [FreeAgent Developer Dashboard](https://dev.freeagent.com) account

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd freeagent-mcp-vercel
bun install
```

### 2. Build the Project

```bash
bun run build
```

### 3. Register a FreeAgent OAuth App

1. Go to [FreeAgent Developer Dashboard](https://dev.freeagent.com)
2. Create a new app and note your **OAuth Client ID** and **Client Secret**
3. Add your Vercel URL as a redirect URI (e.g., `https://your-project.vercel.app`)
   - For local testing, also add `http://localhost:3000`

### 4. Configure Vercel Environment Variables

Set these in **Vercel Dashboard > Settings > Environment Variables**:

| Variable | Value |
|----------|-------|
| `FREEAGENT_CLIENT_ID` | Your OAuth Client ID |
| `FREEAGENT_CLIENT_SECRET` | Your OAuth Client Secret |
| `FREEAGENT_USE_SANDBOX` | `true` for sandbox, `false` for production |

Or via CLI:

```bash
vercel env add FREEAGENT_CLIENT_ID
vercel env add FREEAGENT_CLIENT_SECRET
vercel env add FREEAGENT_USE_SANDBOX
```

### 5. Deploy to Vercel

```bash
vercel --prod
```

### 6. Connect in Claude

**Claude Desktop:**

Add to your config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "freeagent": {
      "url": "https://your-project.vercel.app",
      "transport": "sse"
    }
  }
}
```

**Claude Web (claude.ai):**

1. Go to **Settings > Integrations**
2. Click **Add MCP Server**
3. Enter your server URL: `https://your-project.vercel.app`

### 7. Authorize

When you first connect, you'll be redirected to FreeAgent's login page. Log in and authorize the app - you're all set!

## Quick Test Commands

Once connected, try these in Claude:

- "List all my FreeAgent contacts"
- "Show me recent invoices"
- "What's my company currency?"
- "Create a contact for ABC Limited with email info@abc.com"

## Verify Your Deployment

```bash
# Check health
curl https://your-project.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "freeagent-mcp-server",
  "version": "1.0.0",
  "oauth_mode": "jwt-stateless",
  "freeagent_environment": "sandbox"
}
```

## Troubleshooting

### OAuth flow not starting
- Check environment variables are set in Vercel
- Verify redirect URI matches exactly in FreeAgent app settings
- Test the `/.well-known/oauth-protected-resource` endpoint

### "Invalid token" errors
- Ensure you're using the correct environment (sandbox vs production)
- Tokens expire after 1 hour - reconnect if needed
- Check that `FREEAGENT_USE_SANDBOX` matches your FreeAgent environment

### Rate Limit Error

FreeAgent allows 15 requests per 60 seconds (5 for sandbox):
- Wait 60 seconds before retrying
- The server will tell you exactly how long to wait

### Build errors

- Make sure you ran `bun install`
- Make sure you ran `bun run build`

## Next Steps

- See [OAUTH_SETUP.md](./OAUTH_SETUP.md) for detailed OAuth configuration
- See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for full deployment guide
- See [TOOLS.md](./TOOLS.md) for all available tools
- See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for a pre-flight checklist

## Security Reminders

- **Never commit your Client Secret** to version control
- Use environment variables for sensitive data
- Test with sandbox before using production
- Rotate secrets periodically in FreeAgent dashboard
