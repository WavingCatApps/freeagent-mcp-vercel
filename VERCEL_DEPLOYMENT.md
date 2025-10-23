# Deploying FreeAgent MCP Server to Vercel

This guide walks you through deploying the FreeAgent MCP server to Vercel, allowing you to run it as a serverless function accessible via HTTP/SSE.

## Prerequisites

- A [Vercel account](https://vercel.com/signup)
- [Vercel CLI](https://vercel.com/cli) installed (optional, for local testing)
- FreeAgent OAuth access token (see main README for setup)

## Deployment Steps

### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

**IMPORTANT**: For web deployments, you must use OAuth 2.0 authentication (not personal access tokens).

See [OAUTH_SETUP.md](./OAUTH_SETUP.md) for complete OAuth configuration instructions.

#### Required Environment Variables

1. Go to your project on [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to Settings → Environment Variables
3. Add the following variables:
   - `FREEAGENT_CLIENT_ID`: Your FreeAgent OAuth Client ID
   - `FREEAGENT_CLIENT_SECRET`: Your FreeAgent OAuth Client Secret
   - `FREEAGENT_USE_SANDBOX`: Set to `true` for sandbox, `false` for production

#### Via Vercel CLI

```bash
vercel env add FREEAGENT_CLIENT_ID
vercel env add FREEAGENT_CLIENT_SECRET
vercel env add FREEAGENT_USE_SANDBOX
```

**Note**: The old `FREEAGENT_ACCESS_TOKEN` approach is no longer supported for web deployments. OAuth provides better security and per-user isolation.

### 4. Deploy to Vercel

#### Option A: Deploy via GitHub (Recommended)

1. Push your code to a GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "Add New..." → "Project"
4. Import your GitHub repository
5. Vercel will auto-detect the configuration and deploy

#### Option B: Deploy via Vercel CLI

```bash
# Deploy to production
vercel --prod

# Or deploy to preview
vercel
```

### 5. Test Your Deployment

Once deployed, Vercel will provide you with a URL like `https://your-project.vercel.app`

You can test the endpoint using the MCP Inspector or by configuring it in your MCP client.

## Using with MCP Clients

### Configuration for Claude Desktop

Add this to your Claude Desktop config file:

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

### Configuration for MCP Inspector

```bash
npx @modelcontextprotocol/inspector https://your-project.vercel.app
```

## Architecture

### How It Works

1. **HTTP/SSE Transport**: The server uses Server-Sent Events (SSE) for real-time communication
2. **Serverless Function**: Runs as a Vercel serverless function at `api/index.ts`
3. **Endpoint Routes**:
   - `/` - Main SSE endpoint for MCP connections
   - `/message` - POST endpoint for sending messages

### Project Structure

```
freeagent-mcp-vercel/
├── api/
│   └── index.ts           # Vercel serverless function (HTTP/SSE handler)
├── src/
│   ├── index.ts           # Original stdio-based server (for local use)
│   ├── services/
│   ├── tools/
│   └── schemas/
├── vercel.json            # Vercel configuration
└── package.json
```

## Local Testing

You can test the Vercel function locally using Vercel CLI:

```bash
# Set environment variables
export FREEAGENT_ACCESS_TOKEN="your_token_here"
export FREEAGENT_USE_SANDBOX="true"

# Run local dev server
vercel dev
```

This will start a local server at `http://localhost:3000`

## Troubleshooting

### Function Timeout

Vercel serverless functions have execution time limits:
- **Hobby plan**: 10 seconds
- **Pro plan**: 60 seconds (configured in vercel.json)
- **Enterprise plan**: Up to 900 seconds

If you encounter timeouts, consider upgrading your plan or optimizing API calls.

### Cold Starts

Serverless functions may experience cold starts. The first request after inactivity may be slower. This is normal behavior.

### Environment Variables Not Working

1. Ensure environment variables are set for the correct environment (Development/Preview/Production)
2. Redeploy after adding/changing environment variables
3. Check variable names match exactly (case-sensitive)

### Import/Module Errors

Make sure all imports use `.js` extensions even for TypeScript files:
```typescript
import { something } from "./file.js";  // Correct
import { something } from "./file";     // May cause issues
```

## Security Considerations

1. **Access Token Security**: Never commit access tokens to git. Always use environment variables.
2. **HTTPS**: Vercel automatically provides HTTPS for all deployments.
3. **Rate Limiting**: Consider implementing rate limiting to prevent abuse of your endpoint.
4. **Token Refresh**: Implement token refresh logic for long-lived deployments (see FreeAgent OAuth docs).

## Monitoring and Logs

### View Logs

```bash
# Via Vercel CLI
vercel logs

# Or view in Vercel Dashboard
# Navigate to your project → Deployments → Click deployment → View Logs
```

### Monitor Function Performance

1. Go to Vercel Dashboard
2. Navigate to your project
3. Click "Analytics" to view:
   - Request counts
   - Error rates
   - Execution duration
   - Bandwidth usage

## Cost Considerations

### Vercel Pricing

- **Hobby Plan** (Free):
  - 100GB bandwidth
  - 100 hours serverless function execution
  - Perfect for personal projects and testing

- **Pro Plan** ($20/month):
  - 1TB bandwidth
  - 1000 hours serverless function execution
  - Longer function duration (60s vs 10s)

See [Vercel Pricing](https://vercel.com/pricing) for current details.

### FreeAgent API Limits

Remember FreeAgent API rate limits:
- **Production**: 15 requests per 60 seconds
- **Sandbox**: 5 requests per 60 seconds

## Updating Your Deployment

### Via Git (Recommended)

1. Commit and push changes to your repository
2. Vercel automatically deploys the changes

### Via CLI

```bash
vercel --prod
```

## Rolling Back

If you need to roll back to a previous deployment:

1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the deployment you want to roll back to
3. Click "..." → "Promote to Production"

Or via CLI:
```bash
vercel rollback
```

## Support

- **Vercel Issues**: [Vercel Support](https://vercel.com/support)
- **FreeAgent API**: [FreeAgent API Forum](https://api-discuss.freeagent.com)
- **MCP Protocol**: [MCP Documentation](https://modelcontextprotocol.io)

## Additional Resources

- [Vercel Serverless Functions Documentation](https://vercel.com/docs/functions)
- [MCP SSE Transport Documentation](https://modelcontextprotocol.io/docs/concepts/transports#server-sent-events-sse)
- [FreeAgent API Documentation](https://dev.freeagent.com/docs)
