# FreeAgent MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [FreeAgent](https://www.freeagent.com) accounting API. Enables LLMs to manage contacts, invoices, expenses, timeslips, projects, tasks, bank accounts, and company information.

## Features

- **25 tools** covering contacts, invoices, expenses, timeslips, projects, tasks, bank accounts, bank transaction explanations, categories, company info, and users
- **Two deployment modes**: local (stdio) or cloud (Vercel serverless via Streamable HTTP)
- **OAuth 2.0**: stateless JWT-based auth for serverless, or direct token for local use
- **Tool annotations**: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` on every tool
- **Zod validation**: strict input schemas with `.describe()` on all fields
- **Dual response formats**: Markdown (human-readable) or JSON (structured)
- **Pagination**: proper header parsing with `x-total-count` and `Link` headers
- **Rate limit handling**: clear error messages with retry-after guidance
- **Sandbox support**: test safely against FreeAgent's sandbox environment

## Deployment Options

### Local (stdio) - for Claude Desktop

1. Install and build:
   ```bash
   bun install
   bun run build
   ```

2. Set environment variables:
   ```bash
   export FREEAGENT_ACCESS_TOKEN="your_access_token"
   export FREEAGENT_USE_SANDBOX="true"  # optional
   ```

3. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "freeagent": {
         "command": "node",
         "args": ["/path/to/freeagent-mcp-server/dist/index.js"],
         "env": {
           "FREEAGENT_ACCESS_TOKEN": "your_token",
           "FREEAGENT_USE_SANDBOX": "true"
         }
       }
     }
   }
   ```

### Vercel (Streamable HTTP) - for cloud access

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for full instructions. Key points:

- Uses `StreamableHTTPServerTransport` in stateless mode (no sessions)
- OAuth 2.0 with PKCE via JWT-encoded tokens (no database needed)
- Handles `POST` (tool calls), `GET` (SSE streaming), and `DELETE` (returns 405 - stateless)
- Set `PRODUCTION_URL` env var for stable OAuth callback URLs

Required env vars: `FREEAGENT_CLIENT_ID`, `FREEAGENT_CLIENT_SECRET`, `JWT_SECRET`

## Available Tools

| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_contacts` | List contacts with pagination and sorting | Yes |
| `freeagent_get_contact` | Get contact details by ID | Yes |
| `freeagent_create_contact` | Create a new contact | No |
| `freeagent_list_invoices` | List invoices with status/contact/project filters | Yes |
| `freeagent_get_invoice` | Get invoice details with line items | Yes |
| `freeagent_create_invoice` | Create a draft invoice | No |
| `freeagent_list_expenses` | List expenses with date/view filters | Yes |
| `freeagent_get_expense` | Get expense details (inc. mileage info) | Yes |
| `freeagent_create_expense` | Create expense or mileage claim (with attachments) | No |
| `freeagent_list_timeslips` | List time entries with filters | Yes |
| `freeagent_get_timeslip` | Get timeslip details | Yes |
| `freeagent_create_timeslip` | Create a time entry | No |
| `freeagent_list_bank_accounts` | List all bank accounts | Yes |
| `freeagent_get_bank_account` | Get bank account details | Yes |
| `freeagent_list_bank_transactions` | List transactions for an account | Yes |
| `freeagent_create_bank_transaction_explanation` | Explain/categorize a bank transaction | No |
| `freeagent_list_projects` | List projects with status/contact filters | Yes |
| `freeagent_get_project` | Get project details | Yes |
| `freeagent_create_project` | Create a new project | No |
| `freeagent_list_tasks` | List tasks with project/status filters | Yes |
| `freeagent_get_task` | Get task details | Yes |
| `freeagent_create_task` | Create a task within a project | No |
| `freeagent_list_categories` | List accounting categories | Yes |
| `freeagent_get_category` | Get category by nominal code | Yes |
| `freeagent_get_company` | Get company information | Yes |
| `freeagent_list_users` | List all users | Yes |

## Development

### Prerequisites

- [Bun](https://bun.sh) (used for package management and running scripts)
- Node.js 22.x

### Setup

```bash
bun install
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Compile TypeScript |
| `bun run dev` | Watch mode (auto-recompile) |
| `bun run start` | Run the compiled server |
| `bun run lint` | Run ESLint |
| `bun run test` | Run tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:coverage` | Run tests with coverage |

### Project Structure

```
freeagent-mcp-server/
├── src/
│   ├── index.ts              # Stdio server entry point
│   ├── constants.ts          # Configuration constants & shared utilities
│   ├── types.ts              # TypeScript type definitions
│   ├── schemas/
│   │   ├── index.ts          # Zod validation schemas for all tools
│   │   ├── projects.ts       # Project-specific schemas
│   │   └── schemas.test.ts   # Schema validation tests
│   ├── services/
│   │   ├── api-client.ts     # FreeAgent API client (Axios)
│   │   ├── api-client.test.ts # API client tests
│   │   ├── formatter.ts      # Response formatting utilities
│   │   ├── formatter.test.ts # Formatter tests
│   │   ├── oauth-jwt.ts      # JWT-based OAuth provider (Vercel)
│   │   └── freeagent-auth.ts # Token validation
│   └── tools/
│       ├── contacts.ts       # Contact CRUD
│       ├── invoices.ts       # Invoice management
│       ├── expenses.ts       # Expense & mileage tracking
│       ├── timeslips.ts      # Time tracking
│       ├── bank-accounts.ts  # Bank accounts & transactions
│       ├── bank-transactions.ts # Transaction explanations
│       ├── projects.ts       # Project management
│       ├── tasks.ts          # Task management
│       ├── categories.ts     # Accounting categories
│       └── company.ts        # Company info & users
├── api/
│   └── index.ts              # Vercel serverless entry point
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI (lint, test, build)
├── eslint.config.js          # ESLint flat config
├── vitest.config.ts          # Vitest configuration
├── vercel.json               # Vercel deployment config
├── package.json
└── tsconfig.json
```

### CI

GitHub Actions runs on every push to `main` and on pull requests:
- **Lint**: ESLint with TypeScript rules
- **Test**: Vitest unit tests (no external API calls)
- **Build**: TypeScript compilation check

## Rate Limiting

| Environment | Limit |
|-------------|-------|
| Production | 15 requests / 60 seconds |
| Sandbox | 5 requests / 60 seconds |

The server returns clear error messages with retry-after timing when rate limited.

## Error Handling

All tool handlers return structured errors via `{ isError: true, content: [...] }` (never thrown exceptions). Error messages are designed for LLM consumption with actionable guidance:

| Status | Meaning |
|--------|---------|
| 401 | Token expired - refresh OAuth token |
| 403 | Insufficient permissions |
| 404 | Resource not found or deleted |
| 422 | Validation error with field-level details |
| 429 | Rate limited - retry after N seconds |

## Security

- Access tokens are never logged or committed
- JWT tokens use HS256 signing with configurable secret
- PKCE is used for the OAuth authorization flow
- Strict Zod schemas reject unexpected input fields
- Bearer auth middleware protects all MCP endpoints

## License

MIT

## Links

- [FreeAgent API Docs](https://dev.freeagent.com/docs)
- [MCP Specification](https://modelcontextprotocol.io)
- [FreeAgent Developer Dashboard](https://dev.freeagent.com)
