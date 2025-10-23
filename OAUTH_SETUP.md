# OAuth Setup for FreeAgent MCP Server

This guide explains how to set up OAuth 2.0 authentication for the FreeAgent MCP Server when deployed on Vercel.

## Overview

When deployed to the web (e.g., on Vercel), the MCP server uses OAuth 2.0 to authenticate users via FreeAgent. This means:

1. **Users see FreeAgent's login screen** when connecting the MCP server in Claude
2. **FreeAgent tokens are used directly** - no token mapping or storage complexity
3. **Each user's data is isolated** - the server uses their FreeAgent token for API calls

## Prerequisites

1. A FreeAgent Developer account ([sign up here](https://dev.freeagent.com))
2. A registered FreeAgent OAuth application
3. Your Vercel deployment URL

## Step 1: Register Your OAuth Application

1. Go to [FreeAgent Developer Dashboard](https://dev.freeagent.com)
2. Sign in and navigate to "Apps"
3. Click "Create New App"
4. Fill in the details:
   - **App Name**: `My FreeAgent MCP Server` (or your preferred name)
   - **Description**: `MCP server for Claude integration`
   - **Redirect URIs**: Add your Vercel URL, e.g., `https://your-project.vercel.app`
     - For sandbox testing: Use your preview/development URLs too
     - For local testing: Add `http://localhost:3000`

5. Save your app and note:
   - **OAuth Client ID** (e.g., `abc123xyz...`)
   - **OAuth Client Secret** (e.g., `def456uvw...`)

## Step 2: Configure Vercel Environment Variables

You need to set three environment variables in Vercel:

### Via Vercel Dashboard

1. Go to your project on [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings → Environment Variables**
3. Add the following variables:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `FREEAGENT_CLIENT_ID` | Your OAuth Client ID | From FreeAgent Developer Dashboard |
| `FREEAGENT_CLIENT_SECRET` | Your OAuth Client Secret | From FreeAgent Developer Dashboard |
| `FREEAGENT_USE_SANDBOX` | `true` or `false` | Use `true` for sandbox, `false` for production |

### Via Vercel CLI

```bash
vercel env add FREEAGENT_CLIENT_ID
# Paste your Client ID when prompted

vercel env add FREEAGENT_CLIENT_SECRET
# Paste your Client Secret when prompted

vercel env add FREEAGENT_USE_SANDBOX
# Enter "true" for sandbox or "false" for production
```

## Step 3: Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Or push to GitHub (if using GitHub integration)
git push origin main
```

After deployment, Vercel will provide your production URL, e.g., `https://your-project.vercel.app`

## Step 4: Configure Claude to Use Your MCP Server

### Using Claude Desktop

Add the following to your Claude Desktop config:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### Using Claude Web (claude.ai)

1. Go to [claude.ai](https://claude.ai)
2. Click on **Settings** → **Integrations**
3. Click **Add Integration** or **Add MCP Server**
4. Enter your server URL: `https://your-project.vercel.app`
5. Click **Connect**

## Step 5: Authorize the Connection

When you first connect the MCP server:

1. Claude will redirect you to **FreeAgent's login page**
2. Log in with your FreeAgent credentials
3. Click **Authorize** to grant access
4. You'll be redirected back to Claude
5. The connection is now active!

## How It Works

### OAuth Flow

```
┌─────────┐                                    ┌──────────────┐
│  Claude │                                    │  FreeAgent   │
│         │                                    │  (OAuth AS)  │
└────┬────┘                                    └──────┬───────┘
     │                                                │
     │  1. User connects MCP server                  │
     │─────────────────────────────────────────>     │
     │                                                │
     │  2. Redirect to FreeAgent login               │
     │<──────────────────────────────────────────────│
     │                                                │
     │  3. User logs in and authorizes               │
     │──────────────────────────────────────────────>│
     │                                                │
     │  4. FreeAgent returns authorization code      │
     │<──────────────────────────────────────────────│
     │                                                │
     │  5. Exchange code for access token            │
     │──────────────────────────────────────────────>│
     │                                                │
     │  6. Receive FreeAgent access token            │
     │<──────────────────────────────────────────────│
     │                                                │
     │  7. Use token for all MCP requests            │
     │                                                │
     v                                                v
┌─────────────────────────────────────────────────────┐
│  Your MCP Server (Resource Server)                 │
│  - Validates FreeAgent tokens                       │
│  - Uses tokens to call FreeAgent API                │
└─────────────────────────────────────────────────────┘
```

### Key Points

1. **No token storage**: FreeAgent tokens are passed directly from Claude to your server
2. **Token validation**: Each request validates the token by calling FreeAgent's API
3. **Per-user isolation**: Each user's token grants access only to their FreeAgent data
4. **Automatic expiration**: Tokens expire after 1 hour (FreeAgent's policy)
5. **Refresh tokens**: Claude will automatically refresh tokens when needed

## Testing Your Setup

### Test the Health Endpoint

```bash
curl https://your-project.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "freeagent-mcp-server",
  "version": "1.0.0",
  "oauth_enabled": true,
  "freeagent_environment": "sandbox",
  "client_id_configured": true,
  "timestamp": "2025-10-23T..."
}
```

### Test OAuth Metadata Endpoint

```bash
curl https://your-project.vercel.app/.well-known/oauth-protected-resource
```

This endpoint tells Claude where to send users for authorization.

### Test with a Token

If you have a FreeAgent access token for testing:

```bash
curl -H "Authorization: Bearer YOUR_FREEAGENT_TOKEN" \
     https://your-project.vercel.app/
```

## Troubleshooting

### "client_id_configured: false" in health check

- Ensure `FREEAGENT_CLIENT_ID` environment variable is set in Vercel
- Redeploy after adding environment variables

### "Invalid or expired FreeAgent token" error

- FreeAgent tokens expire after 1 hour
- Claude should automatically refresh - if not, disconnect and reconnect the MCP server
- Verify your token is for the correct environment (sandbox vs production)

### "Redirect URI mismatch" error from FreeAgent

- Ensure your Vercel URL is registered in FreeAgent's app settings
- Check for trailing slashes (use exact match)
- For preview deployments, add the preview URL to your FreeAgent app

### OAuth flow not starting

- Check that `.well-known/oauth-protected-resource` endpoint returns valid JSON
- Verify Claude can reach your Vercel URL (check firewall/network)
- Ensure HTTPS is enabled (required for OAuth)

## Security Considerations

### Production Checklist

- [ ] Use production FreeAgent API (set `FREEAGENT_USE_SANDBOX=false`)
- [ ] Keep Client Secret secure (never commit to git)
- [ ] Use environment-specific redirect URIs
- [ ] Monitor Vercel logs for suspicious activity
- [ ] Regularly rotate Client Secret in FreeAgent dashboard
- [ ] Set appropriate CORS policies if needed

### Token Security

- Tokens are never logged or stored permanently
- Each user's token is isolated to their session
- Tokens are validated on every request
- Invalid tokens are rejected immediately

## Advanced Configuration

### Custom Base URL

If you're using a custom domain:

```bash
vercel env add BASE_URL
# Enter your custom domain, e.g., https://mcp.example.com
```

### Local Development

For local testing:

1. Set environment variables:
```bash
export FREEAGENT_CLIENT_ID="your_client_id"
export FREEAGENT_CLIENT_SECRET="your_client_secret"
export FREEAGENT_USE_SANDBOX="true"
export BASE_URL="http://localhost:3000"
```

2. Run locally:
```bash
vercel dev
```

3. Add `http://localhost:3000` to your FreeAgent app's redirect URIs

## Migration from Non-OAuth Setup

If you previously used `FREEAGENT_ACCESS_TOKEN`:

1. **Remove** the `FREEAGENT_ACCESS_TOKEN` environment variable
2. **Add** `FREEAGENT_CLIENT_ID` and `FREEAGENT_CLIENT_SECRET`
3. **Redeploy** your application
4. **Reconnect** the MCP server in Claude (users will now see the OAuth flow)

The old token-based auth is no longer supported for web deployments.

## Support

- **FreeAgent API**: [FreeAgent Developer Docs](https://dev.freeagent.com/docs/oauth)
- **MCP Protocol**: [MCP Authorization Docs](https://modelcontextprotocol.io/docs/concepts/authorization)
- **Vercel Deployment**: [Vercel Documentation](https://vercel.com/docs)

## License

MIT
