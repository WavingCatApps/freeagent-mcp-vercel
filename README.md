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

- `FREEAGENT_API_URL` - FreeAgent API URL (default: https://api.freeagent.com/v2)
- `FREEAGENT_ACCESS_TOKEN` - Your FreeAgent OAuth access token
- `FREEAGENT_REFRESH_TOKEN` - Your FreeAgent OAuth refresh token
- `FREEAGENT_CLIENT_ID` - Your FreeAgent app client ID
- `FREEAGENT_CLIENT_SECRET` - Your FreeAgent app client secret

### 3. Configure Claude Desktop

Add the following to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "freeagent": {
      "command": "npx",
      "args": [
        "@anthropic-ai/mcp-sdk",
        "mcp-server-http",
        "https://your-deployment.vercel.app/api/mcp"
      ]
    }
  }
}
```

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

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to Vercel
npm run deploy
```

## License

MIT License - see the original [FreeAgent MCP Server](https://github.com/markpitt/freeagent-mcp) for details.