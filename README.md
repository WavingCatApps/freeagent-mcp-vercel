# FreeAgent MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with the FreeAgent accounting API. This server enables LLMs to interact with FreeAgent to manage contacts, invoices, expenses, projects, and company information.

## Features

- **Contact Management**: List, view, and create contacts (customers and suppliers)
- **Invoice Operations**: List, view, and create invoices with full line item support
- **Company Information**: Access company details, settings, and configuration
- **User Management**: List users and their permission levels
- **OAuth 2.0 Authentication**: Secure access using FreeAgent's OAuth 2.0 flow
- **Sandbox Support**: Test integrations safely using FreeAgent's sandbox environment
- **Response Formats**: Choose between human-readable Markdown or structured JSON
- **Pagination**: Efficient handling of large datasets with proper pagination
- **Rate Limiting**: Built-in handling of FreeAgent's API rate limits (15 requests/60 seconds)

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A FreeAgent account (or sandbox account for testing)
- FreeAgent Developer Dashboard access

### Deployment Options

This MCP server can be run in two ways:

1. **Locally via stdio** - For use with Claude Desktop and other local MCP clients
2. **On Vercel as a serverless function** - For cloud-hosted access via HTTP/SSE

### Local Setup (stdio)

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   cd freeagent-mcp-server
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

### Vercel Deployment (HTTP/SSE)

For cloud deployment, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for complete instructions.

## Authentication Setup

### Step 1: Create a FreeAgent Developer Account

1. Go to [FreeAgent Developer Dashboard](https://dev.freeagent.com)
2. Sign up or log in
3. Create a new app

### Step 2: Configure OAuth 2.0

1. In your app settings, note your:
   - OAuth Client ID
   - OAuth Client Secret

2. Set up redirect URIs (for OAuth flow)

### Step 3: Obtain Access Token

You have several options to obtain an OAuth 2.0 access token:

#### Option A: Using Google OAuth Playground (Recommended for Testing)

1. Go to [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the settings icon (⚙️) and select "Use your own OAuth credentials"
3. Enter your FreeAgent OAuth Client ID and Secret
4. Set OAuth endpoints:
   - Authorization endpoint: `https://api.sandbox.freeagent.com/v2/approve_app` (or production URL)
   - Token endpoint: `https://api.sandbox.freeagent.com/v2/token_endpoint`
5. Enter any scope name (e.g., "freeagent")
6. Click "Authorize APIs" and log in to FreeAgent
7. Exchange authorization code for tokens

#### Option B: Implement OAuth Flow in Your Application

```javascript
// Example OAuth flow
const authUrl = `https://api.freeagent.com/v2/approve_app?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code`;

// After user authorizes, exchange code for token
const tokenResponse = await fetch('https://api.freeagent.com/v2/token_endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: REDIRECT_URI
  })
});
```

### Step 4: Set Environment Variables

```bash
export FREEAGENT_ACCESS_TOKEN="your_access_token_here"
export FREEAGENT_USE_SANDBOX="true"  # Optional: use sandbox API
```

For production API, omit the `FREEAGENT_USE_SANDBOX` variable or set it to `"false"`.

## Usage

### Running the Server

```bash
npm start
```

The server runs on stdio and is designed to be used with MCP clients like Claude Desktop.

### Configuration with Claude Desktop

Add this to your Claude Desktop config file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "freeagent": {
      "command": "node",
      "args": ["/absolute/path/to/freeagent-mcp-server/dist/index.js"],
      "env": {
        "FREEAGENT_ACCESS_TOKEN": "your_access_token_here",
        "FREEAGENT_USE_SANDBOX": "true"
      }
    }
  }
}
```

## Available Tools

### Contact Management

#### `freeagent_list_contacts`
List all contacts with pagination and sorting.

**Parameters:**
- `page` (number): Page number (default: 1)
- `per_page` (number): Items per page (default: 25, max: 100)
- `sort` (string): Sort field - `created_at`, `updated_at`, `first_name`, `last_name`, `organisation_name`
- `response_format` (string): `markdown` or `json` (default: `markdown`)

**Example:**
```
List all my FreeAgent contacts
```

#### `freeagent_get_contact`
Get detailed information about a specific contact.

**Parameters:**
- `contact_id` (string): Contact ID or full URL
- `response_format` (string): `markdown` or `json`

**Example:**
```
Show me details for contact 12345
```

#### `freeagent_create_contact`
Create a new contact.

**Parameters:**
- `first_name` (string): First name
- `last_name` (string): Last name
- `organisation_name` (string): Organisation name
- `email` (string): Email address
- `phone_number` (string): Phone number
- Additional address and contact fields

**Example:**
```
Create a contact for ABC Limited with email info@abc.com
```

### Invoice Management

#### `freeagent_list_invoices`
List invoices with filtering and pagination.

**Parameters:**
- `page`, `per_page`: Pagination
- `view` (string): Filter - `all`, `recent_open_or_overdue`, `draft`, `scheduled`, `sent`, `overdue`
- `contact` (string): Filter by contact ID
- `project` (string): Filter by project ID
- `sort` (string): Sort field
- `response_format` (string): Output format

**Example:**
```
Show me all overdue invoices
```

#### `freeagent_get_invoice`
Get detailed invoice information including line items.

**Parameters:**
- `invoice_id` (string): Invoice ID or URL
- `response_format` (string): Output format

#### `freeagent_create_invoice`
Create a new invoice in draft status.

**Parameters:**
- `contact` (string): Contact ID (required)
- `dated_on` (string): Invoice date YYYY-MM-DD (required)
- `invoice_items` (array): Line items (required)
- `due_on` (string): Due date
- `reference` (string): Invoice reference
- `currency` (string): Currency code (default: GBP)
- `comments` (string): Invoice comments

**Example:**
```
Create an invoice for contact 123 dated 2024-01-15 with one item: consulting services, 5 hours at £100/hour
```

### Company & Users

#### `freeagent_get_company`
Get company information including currency, tax status, and accounting dates.

#### `freeagent_list_users`
List all users in the account with their roles and permissions.

## Response Formats

### Markdown Format (Default)
Human-readable format with headers, lists, and formatting. Best for presenting information to users.

### JSON Format
Structured data format. Best for programmatic processing or when you need to parse specific fields.

## Rate Limiting

FreeAgent API has the following rate limits:
- **Production**: 15 requests per 60 seconds
- **Sandbox**: 5 requests per 60 seconds (with `X-RateLimit-Test: true` header)

The server automatically handles rate limit errors and provides clear messages about retry timing.

## Error Handling

The server provides descriptive error messages for common scenarios:

- **401 Unauthorized**: Access token expired or invalid - refresh your token
- **403 Forbidden**: Insufficient permissions - check account permission level
- **404 Not Found**: Resource doesn't exist
- **422 Validation Error**: Invalid input - check field requirements
- **429 Rate Limit**: Too many requests - wait before retrying

## Sandbox vs Production

### Using Sandbox (Recommended for Development)

```bash
export FREEAGENT_USE_SANDBOX="true"
```

- Safe testing environment
- No real financial data
- Isolated from production accounts
- Create free sandbox account at [https://dev.freeagent.com/docs/quick_start](https://dev.freeagent.com/docs/quick_start)

### Using Production

```bash
export FREEAGENT_USE_SANDBOX="false"
# or omit the variable entirely
```

- Real FreeAgent accounts
- Actual financial data
- Use with caution for write operations

## Development

### Project Structure

```
freeagent-mcp-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── constants.ts          # Configuration constants
│   ├── types.ts              # TypeScript type definitions
│   ├── schemas/
│   │   └── index.ts          # Zod validation schemas
│   ├── services/
│   │   ├── api-client.ts     # FreeAgent API client
│   │   └── formatter.ts      # Response formatting utilities
│   └── tools/
│       ├── contacts.ts       # Contact management tools
│       ├── invoices.ts       # Invoice management tools
│       └── company.ts        # Company & user tools
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

This runs TypeScript in watch mode, automatically recompiling on changes.

## API Documentation

For complete FreeAgent API documentation, visit:
- [FreeAgent API Docs](https://dev.freeagent.com/docs)
- [OAuth 2.0 Guide](https://dev.freeagent.com/docs/oauth)
- [API Discussion Forum](https://api-discuss.freeagent.com)

## Troubleshooting

### "Authentication failed" Error

- Check that your access token is valid
- Access tokens expire - use refresh token to obtain new access token
- Verify you're using the correct API (sandbox vs production)

### "Rate limit exceeded" Error

- Wait 60 seconds before retrying
- Reduce request frequency
- Consider caching frequently accessed data

### "Resource not found" Error

- Verify the ID or URL is correct
- Check if resource was deleted
- Ensure you have permission to access the resource

### Connection Issues

- Check internet connectivity
- Verify API endpoint is correct (sandbox vs production)
- Ensure firewall allows HTTPS connections

## Security Best Practices

1. **Never commit access tokens** to version control
2. **Use environment variables** for sensitive configuration
3. **Rotate access tokens** regularly
4. **Use sandbox** for development and testing
5. **Monitor API usage** to detect unusual patterns
6. **Implement token refresh** for long-running applications

## License

MIT

## Support

- For FreeAgent API issues: [FreeAgent Support](https://support.freeagent.com)
- For API discussions: [FreeAgent API Forum](https://api-discuss.freeagent.com)
- For FreeAgent account issues: Contact FreeAgent support

## Contributing

Contributions are welcome! Please ensure:
- Code follows TypeScript best practices
- All tools have comprehensive descriptions
- Error handling is robust
- Documentation is updated

## Acknowledgments

Built with:
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol)
- [FreeAgent API](https://dev.freeagent.com)
- TypeScript, Zod, Axios
