# FreeAgent MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [FreeAgent](https://www.freeagent.com) accounting API. Enables LLMs to manage contacts, invoices, estimates, bills, expenses, timeslips, projects, tasks, bank accounts, and more.

> By my own admission, most of this project is vibe coded.

## Features

- **Broad FreeAgent coverage**: contacts, invoices (incl. transitions and discounts), estimates (incl. transitions), bills, recurring invoices, price list items, expenses, timeslips, projects, tasks, bank accounts, bank transaction explanations, categories, company info, and users
- **Intent-bundle tools**: `reconcile_bank_transaction`, `log_expense`, and `invoice_from_timeslips` collapse multi-call sequences into single tool calls and resolve human-friendly hints (names, codes, references) to FreeAgent URLs server-side
- **MCP elicitation**: `create_invoice` falls back to a form elicitation when `contact` is omitted (on clients that support it)
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

Required env vars: `FREEAGENT_CLIENT_ID`, `FREEAGENT_CLIENT_SECRET`

## Available Tools

See [TOOLS.md](./TOOLS.md) for per-tool parameters and examples. Summary:

### Contacts
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_contacts` | List contacts with pagination and sorting | Yes |
| `freeagent_get_contact` | Get contact details by ID | Yes |
| `freeagent_create_contact` | Create a new contact | No |

### Invoices
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_invoices` | List invoices with status/contact/project filters | Yes |
| `freeagent_get_invoice` | Get invoice details (renders computed discount amount) | Yes |
| `freeagent_create_invoice` | Create a draft invoice (supports `discount_percent`; elicits `contact` if omitted) | No |
| `freeagent_transition_invoice` | mark_as_sent / mark_as_cancelled / mark_as_draft / mark_as_scheduled / convert_to_credit_note | No |
| `freeagent_invoice_from_timeslips` | **Intent bundle**: draft an invoice from a contact's unbilled timeslips | No |

### Estimates
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_estimates` | List estimates with status/contact/project filters | Yes |
| `freeagent_get_estimate` | Get estimate details (renders computed discount amount) | Yes |
| `freeagent_create_estimate` | Draft an estimate (supports `discount_percent`) | No |
| `freeagent_transition_estimate` | mark_as_sent / mark_as_approved / mark_as_rejected / mark_as_cancelled / mark_as_draft / convert_to_invoice | No |

### Bills
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_bills` | List supplier bills with filters | Yes |
| `freeagent_get_bill` | Get bill details | Yes |
| `freeagent_create_bill` | Record a supplier bill | No |

### Recurring Invoices
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_recurring_invoices` | List recurring invoice templates | Yes |
| `freeagent_get_recurring_invoice` | Get template details | Yes |

### Price List Items
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_price_list_items` | List catalog items | Yes |
| `freeagent_get_price_list_item` | Get catalog item details | Yes |
| `freeagent_create_price_list_item` | Add a catalog item | No |

### Expenses
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_expenses` | List expenses with date/view filters | Yes |
| `freeagent_get_expense` | Get expense details (inc. mileage info) | Yes |
| `freeagent_create_expense` | Create expense or mileage claim (with attachments) | No |
| `freeagent_update_expense` | Update an existing expense | No |
| `freeagent_log_expense` | **Intent bundle**: log a regular expense with a positive `amount` + `kind` enum | No |

### Timeslips
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_timeslips` | List time entries with filters | Yes |
| `freeagent_get_timeslip` | Get timeslip details | Yes |
| `freeagent_create_timeslip` | Create a time entry | No |
| `freeagent_update_timeslip` | Update a timeslip (incl. `billed_on_invoice`) | No |

### Bank Accounts & Transactions
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_bank_accounts` | List all bank accounts | Yes |
| `freeagent_get_bank_account` | Get bank account details | Yes |
| `freeagent_list_bank_transactions` | List transactions for an account | Yes |
| `freeagent_get_bank_transaction` | Get bank transaction details | Yes |
| `freeagent_list_bank_transaction_explanations` | List transaction explanations | Yes |
| `freeagent_get_bank_transaction_explanation` | Get explanation details | Yes |
| `freeagent_create_bank_transaction_explanation` | Explain/categorize a bank transaction | No |
| `freeagent_update_bank_transaction_explanation` | Update a transaction explanation | No |
| `freeagent_reconcile_bank_transaction` | **Intent bundle**: explain a transaction with a category name / invoice ref / bill ref | No |

### Projects & Tasks
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_projects` | List projects with status/contact filters | Yes |
| `freeagent_get_project` | Get project details | Yes |
| `freeagent_create_project` | Create a new project | No |
| `freeagent_list_tasks` | List tasks with project/status filters | Yes |
| `freeagent_get_task` | Get task details | Yes |
| `freeagent_create_task` | Create a task within a project | No |

### Categories, Company & Users
| Tool | Description | Read-only |
|------|-------------|-----------|
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
│   ├── index.ts                       # Stdio server entry point
│   ├── constants.ts                   # Configuration constants & shared utilities
│   ├── types.ts                       # TypeScript type definitions
│   ├── schemas/
│   │   ├── index.ts                   # Zod validation schemas for all tools
│   │   ├── projects.ts                # Project-specific schemas
│   │   └── schemas.test.ts            # Schema validation tests
│   ├── services/
│   │   ├── api-client.ts              # FreeAgent API client (Axios)
│   │   ├── api-client.test.ts         # API client tests
│   │   ├── formatter.ts               # Response formatting utilities (incl. discount amount helper)
│   │   ├── formatter.test.ts          # Formatter tests
│   │   ├── resolvers.ts               # Shared resolvers (category / user / contact / bill hints → URLs)
│   │   ├── oauth-jwt.ts               # JWT-based OAuth provider (Vercel)
│   │   └── freeagent-auth.ts          # Token validation
│   └── tools/
│       ├── register.ts                # Shared tool definitions, registration, ToolContext (elicitation)
│       ├── contacts.ts                # Contact CRUD
│       ├── invoices.ts                # Invoice management (incl. elicitation fallback)
│       ├── transition-invoice.ts      # Invoice lifecycle transitions
│       ├── invoice-from-timeslips.ts  # Intent bundle: draft an invoice from unbilled time
│       ├── estimates.ts               # Estimates + transition_estimate
│       ├── bills.ts                   # Supplier bills
│       ├── recurring-invoices.ts      # Recurring invoice templates (read-only)
│       ├── price-list-items.ts        # Catalog items
│       ├── expenses.ts                # Expense & mileage tracking
│       ├── log-expense.ts             # Intent bundle: positive-amount expense logging
│       ├── timeslips.ts               # Time tracking (incl. update_timeslip)
│       ├── bank-accounts.ts           # Bank accounts & transactions
│       ├── bank-transactions.ts       # Transaction explanations
│       ├── reconcile.ts               # Intent bundle: reconcile a transaction in one call
│       ├── projects.ts                # Project management
│       ├── tasks.ts                   # Task management
│       ├── categories.ts              # Accounting categories
│       └── company.ts                 # Company info & users
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
