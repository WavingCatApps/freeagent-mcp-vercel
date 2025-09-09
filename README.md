# FreeAgent MCP Server

A comprehensive MCP server for the [FreeAgent API](https://dev.freeagent.com) that enables AI platforms and development tools to interact with FreeAgent for full accounting operations including timeslips, expenses, bills, bank transactions, and more.

**Supported Platforms:** Claude, ChatGPT, Gemini, AWS Bedrock, Microsoft Copilot Studio, Replit, Zed, Sourcegraph, Windsurf, Cursor, GitHub Copilot, VS Code, mcpli

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Deployment Options

This server supports **two deployment modes**:

1. **Vercel Deployment** - Run as a hosted HTTP MCP server
2. **Local stdio** - Run locally for tools like mcpli

## Features

### Time Tracking
- **Timeslips**: Create, update, delete, and list time entries with filtering
- **Timer Controls**: Start and stop timers for timeslips
- **Project Management**: List projects with filtering options
- **Task Management**: Create and manage tasks for projects

### Financial Management
- **Bank Accounts**: List and manage multiple bank accounts
- **Bank Transactions**: List, filter, and manage bank transactions
- **Transaction Explanations**: Create detailed explanations for transactions with tax handling
- **Expenses**: Full expense management with mileage claims and receipt handling
- **Bills**: Complete supplier bill management with line items and VAT Reverse Charge support
- **Categories**: Manage expense and income categories

### User Management
- **Users**: List and manage FreeAgent users for expense assignments

### Attachments
- **Attachment Management**: Reference and manage existing attachments for expenses and transactions
- **⚠️ IMPORTANT**: Attachments must be uploaded to FreeAgent via the web interface or mobile app first - Claude and other AI tools can only reference existing attachments, not upload new files

### Advanced Features
- **Tax Support**: Handle sales tax, VAT, and other tax calculations
- **Multi-currency**: Support for different currencies
- **Mileage Claims**: Detailed vehicle and engine type tracking
- **Tool Introspection**: Built-in documentation and parameter validation
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

#### mcpli Usage
For command-line usage with [mcpli](https://github.com/cameroncooke/mcpli):

1. **Install dependencies and build**:
   ```bash
   npm install
   npm run build
   ```

2. **Set environment variables**:
   ```bash
   export FREEAGENT_CLIENT_ID="your_client_id"
   export FREEAGENT_CLIENT_SECRET="your_client_secret"
   export FREEAGENT_ACCESS_TOKEN="your_access_token"
   export FREEAGENT_REFRESH_TOKEN="your_refresh_token"
   ```

3. **Use with mcpli**:
   ```bash
   # List timeslips
   mcpli list_timeslips -- node ./dist/index.js
   
   # List projects
   mcpli list_projects -- node ./dist/index.js
   
   # Get help for all available tools
   mcpli --help -- node ./dist/index.js
   ```

#### Other AI Platforms & Development Tools
Use the HTTP endpoint directly in your platform's MCP configuration:

**Supported Platforms:**
- OpenAI ChatGPT
- Google Gemini / AI Studio  
- AWS Bedrock
- Microsoft Copilot Studio
- Replit
- Zed Editor
- Sourcegraph
- Windsurf
- Cursor

**Endpoint:**
```
https://your-deployment.vercel.app/api/mcp?suffix=your-random-suffix
```

**Note:** If you set `ENDPOINT_PATH_SUFFIX`, include it in your URL as `?suffix=your-suffix-value`

## Available Tools

This MCP server provides 40+ tools across multiple categories. Key tools include:

### Time Tracking Tools
- `list_timeslips` - List and filter timeslips with date ranges and status filters
- `create_timeslip` - Create new time entries with project, task, and user details
- `update_timeslip` - Modify existing time entries
- `start_timer`/`stop_timer` - Control timeslip timers
- `list_projects` - List projects with filtering options
- `create_task` - Create new tasks for projects

### Financial Tools
- `list_bank_accounts` - List all connected bank accounts
- `list_bank_transactions` - List transactions with comprehensive filtering
- `create_bank_transaction_explanation` - Explain transactions with tax handling
- `list_expenses` - List expenses with filtering and categorization
- `create_expense` - Create expenses with mileage claims and attachments
- `list_categories` - Manage expense and income categories

### User Management
- `list_users` - List FreeAgent users for expense assignments

### Attachment Tools
- `get_attachment` - View attachment details
- `delete_attachment` - Remove unnecessary attachments

**⚠️ ATTACHMENT IMPORTANT LIMITATIONS**: 
- Attachments must be uploaded to FreeAgent via the web interface or mobile app first
- AI tools cannot upload binary files - they can only reference existing attachments by URL
- FreeAgent's API does not provide a way to list/discover attachments - you must know the attachment URL from the FreeAgent interface
- **Attachment URLs are impossible to see on the mobile app and not immediately obvious on the web interface**
- **Workaround**: Use FreeAgent's Smart Capture feature to automatically extract data and create expenses/explanations (limited to 10 smart captures per month for most customers)

### Tool Discovery
- `describe_tools` - Get detailed specifications for all available tools
- `get_api_docs` - Access comprehensive API documentation
- `validate_parameters` - Validate tool parameters before execution

Use the `describe_tools` command within your AI platform to see all available tools with their complete parameter specifications.

**💡 Smart Capture Alternative**: For automated receipt processing, consider using FreeAgent's Smart Capture feature instead of manual attachment handling. Smart Capture automatically extracts data from receipts and creates expenses/explanations, though most customers are limited to 10 smart captures per month (additional captures available as a paid extra).

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

# Run locally with Vercel CLI
vercel dev

# Deploy to Vercel
npm run deploy
```

**Local testing:** Security validation is relaxed in development mode to allow MCP inspector tools.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Attribution

- OAuth token setup script adapted from [FreeAgent MCP Server](https://github.com/markpitt/freeagent-mcp) by Mark Pitt.
- Original FreeAgent MCP implementation by [markpitt/freeagent-mcp](https://github.com/markpitt/freeagent-mcp).
- FreeAgent for their [excellent API documentation](https://dev.freeagent.com/).