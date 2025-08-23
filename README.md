# FreeAgent MCP Server for Vercel

A Vercel-hosted wrapper for the [FreeAgent MCP Server](https://github.com/markpitt/freeagent-mcp) that enables AI platforms (Claude, ChatGPT, Gemini, AWS Bedrock) to interact with FreeAgent for managing timeslips and timers, with a few new features added.

## Features

- **List Timeslips**: Filter by date range, view options (all/unbilled/running)
- **Create Timeslips**: Add new time entries with task, user, project details
- **Update Timeslips**: Modify existing time entries
- **Get Timeslips**: Retrieve specific timeslips by ID
- **Delete Timeslips**: Remove time entries from FreeAgent
- **Timer Controls**: Start and stop timers for timeslips
- **Project Management**: List all projects with filtering options
- **Task Management**: Create new tasks for projects
- **Serverless**: Runs on Vercel's edge functions for global availability

## Setup

### 1. Get FreeAgent API Credentials

#### Register Your Application

1. Go to the [FreeAgent Developer Dashboard](https://dev.freeagent.com)
2. Log in with your FreeAgent credentials
3. Create a new application with these settings:
   - **Name**: Choose any name for your MCP server
   - **Redirect URI**: `http://localhost:3456/oauth/callback`
   - **Description**: Optional description
4. Note down your **Client ID** and **Client Secret**

#### Get OAuth Tokens

**Option A: Using npx (Recommended)**

The easiest way to get your OAuth tokens without cloning the repo:

```bash
npx freeagent-mcp-vercel get-tokens YOUR_CLIENT_ID YOUR_CLIENT_SECRET
```

**Option B: Clone and Run Locally**

```bash
# Clone and setup this repository
git clone https://github.com/WavingCatApps/freeagent-mcp-vercel.git
cd freeagent-mcp-vercel
npm install

# Run the OAuth token script
npm run get-tokens YOUR_CLIENT_ID YOUR_CLIENT_SECRET
```

The script will:
1. Open your browser to FreeAgent's authorization page
2. After you approve the application, redirect back to a local server
3. Exchange the authorization code for access and refresh tokens
4. Display the tokens in your terminal

**Example output:**
```
Add these tokens to your Vercel environment variables:

FREEAGENT_ACCESS_TOKEN=your_access_token_here
FREEAGENT_REFRESH_TOKEN=your_refresh_token_here
```

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/WavingCatApps/freeagent-mcp-vercel)

### 3. Configure Environment Variables

In your Vercel dashboard, add the following environment variables:

**Required:**
- `FREEAGENT_API_URL` - FreeAgent API URL (default: https://api.freeagent.com/v2)
- `FREEAGENT_ACCESS_TOKEN` - Your FreeAgent OAuth access token (from step 1)
- `FREEAGENT_REFRESH_TOKEN` - Your FreeAgent OAuth refresh token (from step 1)
- `FREEAGENT_CLIENT_ID` - Your FreeAgent app client ID (from step 1)
- `FREEAGENT_CLIENT_SECRET` - Your FreeAgent app client secret (from step 1)

**Optional, but recommended, Security:**
- `ENDPOINT_PATH_SUFFIX` - Random string to make your endpoint URL unpredictable (e.g., `x7k9m2n8p4q1r5s`)
  
  Generate a secure random string with:
  ```bash
  # Using Node.js
  node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
  
  # Using OpenSSL
  openssl rand -hex 16
  ```

### 4. Configure Your AI Platform

#### Claude UI (Connectors)
Add your MCP server as a connector using this URL format:
```
https://your-deployment.vercel.app/api/mcp?suffix=your-random-suffix
```

#### Claude Desktop
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

#### OpenAI ChatGPT / Other Platforms
Use the HTTP endpoint directly in your AI platform's MCP configuration:
```
https://your-deployment.vercel.app/api/mcp?suffix=your-random-suffix
```

**Note:** If you set `ENDPOINT_PATH_SUFFIX`, include it in your URL as `?suffix=your-suffix-value`

## Available Tools

### list_timeslips
List and filter timeslips from FreeAgent.

**Parameters:**
- `from_date` (optional): Start date in YYYY-MM-DD format
- `to_date` (optional): End date in YYYY-MM-DD format  
- `view` (optional): Filter view ("all", "unbilled", or "running")
- `user` (optional): User URL to filter by
- `project` (optional): Project URL to filter by
- `task` (optional): Task URL to filter by

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

### list_projects
List all projects in FreeAgent.

**Parameters:**
- `view` (optional): Filter view ("all", "active", or "completed") - default: "active"

### create_task
Create a new task for a project in FreeAgent.

**Parameters:**
- `project`: Project URL or ID
- `name`: Task name
- `is_recurring` (optional): Whether this is a recurring task (default: false)
- `status` (optional): Task status ("Active", "Hidden", or "Completed") - default: "Active"

### get_timeslip
Get a specific timeslip by ID.

**Parameters:**
- `id`: Timeslip ID

### delete_timeslip
Delete a timeslip from FreeAgent.

**Parameters:**
- `id`: Timeslip ID

## Security Features

This MCP server includes several security measures:

- **Request validation**: Only allows requests from legitimate AI platforms (Claude, ChatGPT, Gemini, AWS Bedrock), development tools (GitHub Copilot, VS Code), and MCP inspector tools
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

## Attribution

- OAuth token setup script adapted from [FreeAgent MCP Server](https://github.com/markpitt/freeagent-mcp) by Mark Pitt
- Original FreeAgent MCP implementation by [markpitt/freeagent-mcp](https://github.com/markpitt/freeagent-mcp)