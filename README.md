# FreeAgent MCP Server for Vercel

A Vercel-hosted wrapper for the [FreeAgent MCP Server](https://github.com/markpitt/freeagent-mcp) that enables Claude to interact with FreeAgent for managing timeslips and timers.

## Features

- **List Timeslips**: Filter by date range, view options (all/unbilled/running)
- **Create Timeslips**: Add new time entries with task, user, project details
- **Update Timeslips**: Modify existing time entries
- **Timer Controls**: Start and stop timers for timeslips
- **Serverless**: Runs on Vercel's edge functions for global availability

## Setup

### 1. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/freeagent-mcp-vercel)

### 2. Configure Environment Variables

In your Vercel dashboard, add the following environment variables:

**Required:**
- `FREEAGENT_API_URL` - FreeAgent API URL (default: https://api.freeagent.com/v2)
- `FREEAGENT_ACCESS_TOKEN` - Your FreeAgent OAuth access token
- `FREEAGENT_REFRESH_TOKEN` - Your FreeAgent OAuth refresh token
- `FREEAGENT_CLIENT_ID` - Your FreeAgent app client ID
- `FREEAGENT_CLIENT_SECRET` - Your FreeAgent app client secret

**Optional Security:**
- `ENDPOINT_PATH_SUFFIX` - Random string to make your endpoint URL unpredictable (e.g., `x7k9m2n8p4q1r5s`)
  
  Generate a secure random string with:
  ```bash
  # Using Node.js
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  
  # Using OpenSSL
  openssl rand -hex 16
  ```

### 3. Configure Claude

#### For Claude UI (Connectors)
Add your MCP server as a connector using this URL format:
```
https://your-deployment.vercel.app/api/mcp?suffix=your-random-suffix
```

#### For Claude Desktop
Add the following to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "freeagent": {
      "command": "npx",
      "args": [
        "@anthropic-ai/mcp-sdk",
        "mcp-server-http",
        "https://your-deployment.vercel.app/api/mcp?suffix=your-random-suffix"
      ]
    }
  }
}
```

**Note:** If you set `ENDPOINT_PATH_SUFFIX`, include it in your URL as `?suffix=your-suffix-value`

## FreeAgent API Setup

1. Register a new application in your FreeAgent account settings
2. Note down your Client ID and Client Secret
3. Follow the OAuth flow to get access and refresh tokens
4. Configure the environment variables in Vercel

## Available Tools

### list_timeslips
List and filter timeslips from FreeAgent.

**Parameters:**
- `from_date` (optional): Start date in YYYY-MM-DD format
- `to_date` (optional): End date in YYYY-MM-DD format  
- `view` (optional): Filter view ("all", "unbilled", or "running")
- `nested` (optional): Include nested resources

### create_timeslip
Create a new timeslip in FreeAgent.

**Parameters:**
- `task`: Task URL or ID
- `user`: User URL or ID
- `project`: Project URL or ID
- `dated_on`: Date in YYYY-MM-DD format
- `hours`: Number of hours
- `comment` (optional): Optional comment

### update_timeslip
Update an existing timeslip in FreeAgent.

**Parameters:**
- `id`: Timeslip ID
- `task` (optional): Task URL or ID
- `user` (optional): User URL or ID
- `project` (optional): Project URL or ID
- `dated_on` (optional): Date in YYYY-MM-DD format
- `hours` (optional): Number of hours
- `comment` (optional): Comment

### start_timer
Start a timer for a timeslip in FreeAgent.

**Parameters:**
- `id`: Timeslip ID

### stop_timer
Stop a timer for a timeslip in FreeAgent.

**Parameters:**
- `id`: Timeslip ID

## Security Features

This MCP server includes several security measures:

- **Request validation**: Only allows requests from Claude, Copilot, and MCP inspector tools
- **Rate limiting**: 100 requests per minute per IP address
- **CORS protection**: Restricts cross-origin requests to legitimate domains
- **Optional URL suffix**: Add `ENDPOINT_PATH_SUFFIX` environment variable for URL obfuscation

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Vercel
npm run deploy
```

**Local testing:** Security validation is relaxed in development mode to allow MCP inspector tools.

## License

MIT License - see the original [FreeAgent MCP Server](https://github.com/markpitt/freeagent-mcp) for details.