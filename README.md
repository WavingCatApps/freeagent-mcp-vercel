# FreeAgent MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [FreeAgent](https://www.freeagent.com) accounting API. Enables LLMs to manage contacts, invoices, estimates, bills, expenses, timeslips, projects, tasks, bank accounts, and more.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FWavingCatApps%2Ffreeagent-mcp-vercel&project-name=freeagent-mcp&repository-name=freeagent-mcp&env=FREEAGENT_CLIENT_ID,FREEAGENT_CLIENT_SECRET,JWT_SECRET,FREEAGENT_USE_SANDBOX&envDefaults=%7B%22FREEAGENT_USE_SANDBOX%22%3A%22true%22%7D&envDescription=FreeAgent%20OAuth%20Client%20ID%2FSecret%20from%20https%3A%2F%2Fdev.freeagent.com.%20Set%20JWT_SECRET%20with%3A%20openssl%20rand%20-hex%2032.%20After%20deploy%2C%20add%20https%3A%2F%2FYOUR_PROJECT.vercel.app%2Foauth%2Fcallback%20as%20a%20FreeAgent%20redirect%20URI.&envLink=https%3A%2F%2Fgithub.com%2FWavingCatApps%2Ffreeagent-mcp-vercel%2Fblob%2Fmaster%2FOAUTH_SETUP.md)

> By my own admission, most of this project is vibe coded.

## Features

- **Broad FreeAgent coverage**: contacts, invoices (incl. transitions, email, duplicate, direct debit), estimates, bills, recurring invoices, price list items, expenses (with receipts), timeslips, projects, tasks, bank accounts/feeds/statements (JSON lines), bank explanation receipts (multi-file), credit notes + reconciliations, notes, attachment metadata, journals, capital assets, accounting reports (P&amp;L, balance sheet, trial balance, cashflow, ledger), VAT/corp tax/income tax/final accounts, payroll, properties/stock/hire purchases, CIS, sales tax periods, account locks, categories, company info, and users
- **Intent-bundle tools**: `reconcile_bank_transaction`, `log_expense`, and `invoice_from_timeslips` collapse multi-call sequences into single tool calls and resolve human-friendly hints (names, codes, references) to FreeAgent URLs server-side
- **Tool-search mode** (`FREEAGENT_TOOL_SEARCH=true`): optional — collapses the catalog behind `freeagent_search_tools` / `freeagent_call_tool` for a smaller `tools/list`. Default is the full catalog (including on Vercel)
- **MCP elicitation**: `create_invoice` falls back to a form elicitation when `contact` is omitted (on clients that support it)
- **Three deployment modes**: local stdio, self-hosted HTTP (Docker / Apple Container / Tailscale), or Vercel serverless
- **OAuth 2.0**: stateless JWT-based auth for serverless, or direct token for local use
- **Receipt attachments without model base64**: local `attachment.path` under `FREEAGENT_ATTACHMENTS_DIR`, remote S3-compatible `upload_id` staging, or inline `data` fallback
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

   # optional: refresh the access token automatically when it expires
   export FREEAGENT_REFRESH_TOKEN="your_refresh_token"
   export FREEAGENT_CLIENT_ID="your_client_id"
   export FREEAGENT_CLIENT_SECRET="your_client_secret"
   export FREEAGENT_TOKEN_CACHE="$HOME/.config/freeagent-mcp/tokens.json"  # optional, this is the default

   # optional: local receipt attachments via attachment.path (dedicated folder only)
   export FREEAGENT_ATTACHMENTS_DIR="$HOME/.config/freeagent-mcp/receipts"
   mkdir -p "$FREEAGENT_ATTACHMENTS_DIR"
   ```

   With the refresh variables set, a 401 triggers a token refresh and one retry. The newest tokens are saved to the cache file (mode 600) and used on the next start, so you only need to repeat the OAuth flow if the refresh token itself is revoked.

   With `FREEAGENT_ATTACHMENTS_DIR` set, pass `attachment: { path: "/…/receipts/taxi.pdf" }` on create/update expense or bank explanation — the server reads the file. Do not point that env var at your home directory.

3. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "freeagent": {
         "command": "node",
         "args": ["/path/to/freeagent-mcp-server/dist/index.js"],
         "env": {
           "FREEAGENT_ACCESS_TOKEN": "your_token",
           "FREEAGENT_USE_SANDBOX": "true",
           "FREEAGENT_ATTACHMENTS_DIR": "/path/to/freeagent-mcp-server/receipts"
         }
       }
     }
   }
   ```

### Docker / Apple Container (Streamable HTTP)

Build and run the OAuth HTTP server in an OCI container (Docker Engine or [Apple Container](https://github.com/apple/container)). Good fit for LAN / Tailscale: put the container behind Tailscale Serve and keep receipts on a host volume.

```bash
mkdir -p ./receipts
docker build -t freeagent-mcp .
docker run --rm -p 3000:3000 \
  -v "$PWD/receipts:/receipts" \
  -e FREEAGENT_CLIENT_ID \
  -e FREEAGENT_CLIENT_SECRET \
  -e JWT_SECRET \
  -e FREEAGENT_USE_SANDBOX=true \
  -e BASE_URL=http://localhost:3000 \
  freeagent-mcp
```

The image defaults `FREEAGENT_ATTACHMENTS_DIR=/receipts`. Drop files into the mounted host folder and pass `attachment: { path: "/receipts/taxi.pdf" }` on expense / bank-explanation create or update — same confined path reads as stdio.

Health check: `curl http://localhost:3000/health`. For stdio inside the same image: `docker run -i --rm -v "$PWD/receipts:/receipts" -e FREEAGENT_ACCESS_TOKEN … freeagent-mcp bun dist/index.js`.

### Vercel (Streamable HTTP) - for cloud access

One-click deploy (clones this repo into your Git account and prompts for env vars):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FWavingCatApps%2Ffreeagent-mcp-vercel&project-name=freeagent-mcp&repository-name=freeagent-mcp&env=FREEAGENT_CLIENT_ID,FREEAGENT_CLIENT_SECRET,JWT_SECRET,FREEAGENT_USE_SANDBOX&envDefaults=%7B%22FREEAGENT_USE_SANDBOX%22%3A%22true%22%7D&envDescription=FreeAgent%20OAuth%20Client%20ID%2FSecret%20from%20https%3A%2F%2Fdev.freeagent.com.%20Set%20JWT_SECRET%20with%3A%20openssl%20rand%20-hex%2032.%20After%20deploy%2C%20add%20https%3A%2F%2FYOUR_PROJECT.vercel.app%2Foauth%2Fcallback%20as%20a%20FreeAgent%20redirect%20URI.&envLink=https%3A%2F%2Fgithub.com%2FWavingCatApps%2Ffreeagent-mcp-vercel%2Fblob%2Fmaster%2FOAUTH_SETUP.md)

After deploy, register `https://YOUR_PROJECT.vercel.app/oauth/callback` on your FreeAgent OAuth app (see [OAUTH_SETUP.md](./OAUTH_SETUP.md)). Full walkthrough: [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

Key points:

- Uses `StreamableHTTPServerTransport` in stateless mode (no sessions) with `enableJsonResponse: true` (avoids empty SSE bodies on Vercel)
- OAuth 2.0 with PKCE via JWT-encoded tokens (no database needed)
- Handles `POST` (JSON-RPC tool calls); `GET`/`DELETE` return 405 in this serverless/stateless deploy (no durable SSE sessions)
- Set `PRODUCTION_URL` (or rely on `VERCEL_PROJECT_PRODUCTION_URL`) for stable production OAuth callback URLs. Preview OAuth uses the request host (or `VERCEL_URL`) so short per-deploy hosts match FreeAgent `*` wildcards.

Required env vars: `FREEAGENT_CLIENT_ID`, `FREEAGENT_CLIENT_SECRET`, `JWT_SECRET` (stable secret required on Vercel so OAuth JWTs verify across serverless instances)

## Tool-Search Mode (optional)

By default the server registers every catalog tool directly (~165 definitions in `tools/list`), including on Vercel. That path is reliable again after the tools/list schema fixes.

If you want a smaller `tools/list` (e.g. many MCP servers competing for context), opt in:

```bash
export FREEAGENT_TOOL_SEARCH=true   # only freeagent_search_tools + freeagent_call_tool
```

Unset it (or anything other than `true`/`1`) to keep the full catalog.

| Tool | Purpose |
|------|---------|
| `freeagent_search_tools` | Search the catalog and return JSONSchema for matching tools. Query forms: `select:name1,name2` for direct lookup, `+required optional` for scored search with required keywords, or plain keywords for a ranked search. |
| `freeagent_call_tool` | Invoke any catalog tool by name with validated arguments (`{ name, arguments }`). Pair with `search_tools` to discover schemas on demand. |

This mirrors the deferred-loading pattern used by Claude Code's internal `ToolSearch`.

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

### Expenses & receipt uploads
| Tool | Description | Read-only |
|------|-------------|-----------|
| `freeagent_list_expenses` | List expenses with date/view filters | Yes |
| `freeagent_get_expense` | Get expense details (inc. mileage info) | Yes |
| `freeagent_create_expense` | Create expense or mileage claim (with receipt attachment) | No |
| `freeagent_update_expense` | Update an expense (can add a receipt) | No |
| `freeagent_log_expense` | **Intent bundle**: log a regular expense with a positive `amount` + `kind` enum | No |
| `freeagent_prepare_attachment_upload` | Mint a short-lived PUT URL + `upload_id` for remote receipt staging | No |

Receipts accept exactly one of `attachment.path` (local `FREEAGENT_ATTACHMENTS_DIR`), `attachment.upload_id` (after prepare + PUT), or inline `attachment.data` (base64 fallback). See [TOOLS.md — Working with Attachments](./TOOLS.md#working-with-attachments).

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
| `freeagent_get_bank_transaction` | Get bank transaction details (nested explanations include `has_attachment`) | Yes |
| `freeagent_list_bank_transaction_explanations` | List explanations (each row: `has_attachment` / attachment URLs) | Yes |
| `freeagent_get_bank_transaction_explanation` | Get explanation details (inc. attachment metadata) | Yes |
| `freeagent_list_bank_transaction_explanation_attachments` | List file name/size/type for an explanation's receipts | Yes |
| `freeagent_create_bank_transaction_explanation` | Explain/categorize a bank transaction (optional receipts) | No |
| `freeagent_update_bank_transaction_explanation` | Update an explanation / **add** receipts (up to 10 per call, 50 max) | No |
| `freeagent_reconcile_bank_transaction` | **Intent bundle**: explain a transaction with a category name / invoice ref / bill ref | No |
| `freeagent_get_attachment` | Attachment metadata (download URL; bytes not inlined) | Yes |
| `freeagent_delete_attachment` | Delete an attachment (`bank_transaction_explanation_id` → Explanation Attachments `_destroy`) | No |
| `freeagent_delete_all_bank_transaction_explanation_attachments` | Clear every receipt on an explanation | No |

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


## Intentional omissions

- **Timeslip timers** — start/stop timer endpoints are not exposed (poor MCP fit).
- **Binary PDF download tools** — invoice/estimate/credit-note PDF bytes are not returned (no efficient agentic binary channel yet).
- **File-based bank statement upload** — use `freeagent_upload_bank_statement` with JSON lines instead. Expense/explanation **receipt** attachments are supported via `path` / `upload_id` / inline `data` (see Features).
- **Accountancy Practice API** — practice/client endpoints are out of scope for this company-facing server.

## Development

### Prerequisites

- [Bun](https://bun.sh) (used for package management and running scripts)
- Node.js 24.x

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
│   │   ├── gaps.ts                    # Gap-coverage schemas (attachments, tax, …)
│   │   ├── projects.ts                # Project-specific schemas
│   │   └── schemas.test.ts            # Schema validation tests
│   ├── services/
│   │   ├── api-client.ts              # FreeAgent API client (Axios)
│   │   ├── attachment-local-path.ts   # Confined FREEAGENT_ATTACHMENTS_DIR reads
│   │   ├── attachment-payload.ts      # path / upload_id / data → FreeAgent payload
│   │   ├── attachment-staging.ts      # S3-compatible prepare / fetch / cleanup
│   │   ├── explanation-attachments.ts # Bank explanation Attachments API (2026-09-01)
│   │   ├── formatter.ts               # Response formatting utilities
│   │   ├── resolvers.ts               # Shared resolvers (category / user / contact / bill hints → URLs)
│   │   ├── oauth-jwt.ts               # JWT-based OAuth provider (Vercel)
│   │   └── freeagent-auth.ts          # Token validation
│   └── tools/
│       ├── register.ts                # Shared tool definitions, registration, ToolContext
│       ├── prepare-attachment-upload.ts
│       ├── attachments.ts             # get / delete attachment (+ delete-all on explanations)
│       ├── expenses.ts                # Expense & mileage tracking
│       ├── bank-transactions.ts       # Transaction explanations (+ multi-receipt)
│       ├── …                          # contacts, invoices, estimates, bills, timeslips, …
├── api/
│   └── index.ts              # Vercel serverless entry point
├── skills/
│   └── file-to-base64/       # Claude Code skill — inline attachment.data fallback only
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI (lint, test, build)
├── eslint.config.js
├── vitest.config.ts
├── vercel.json
├── package.json
└── tsconfig.json
```

### CI

GitHub Actions runs on every push to `main` and on pull requests:
- **Lint**: ESLint with TypeScript rules
- **Test**: Vitest unit tests (no external API calls)
- **Build**: TypeScript compilation check

## Rate Limiting

FreeAgent enforces these limits per user ([docs](https://dev.freeagent.com/docs/introduction)):

| Limit | Value |
|-------|-------|
| Requests | 120 / minute, 3600 / hour |
| Token refreshes | 15 / minute |
| Sandbox test (`X-RateLimit-Test: true`) | 5 / minute |

On HTTP 429 the API client returns a clear error that includes FreeAgent's `Retry-After` value (defaulting to 60 seconds if omitted). It does not automatically sleep and retry — that is left to the MCP client / LLM so serverless invocations are not held open.

## Error Handling

All tool handlers return structured errors via `{ isError: true, content: [...] }` (never thrown exceptions). Error messages are designed for LLM consumption with actionable guidance.

FreeAgent does not publish a full catalogue of error codes ([forum](https://api-discuss.freeagent.com/t/list-of-api-error-responses/2809)); they use standard HTTP statuses plus a response body. This client maps the common ones:

| Status | Handling |
|--------|----------|
| 401 | Auth failure message; stdio/OAuth can also refresh-and-retry once |
| 403 | Permissions message; prefers FreeAgent's plain-text / light-HTML body when present |
| 404 | Not-found message |
| 400 | Explicit bad-request message, including FreeAgent body detail when present |
| 422 | Parses FreeAgent `errors` array/object into field guidance |
| 429 | Surfaces `Retry-After` (no sleep/auto-retry in the serverless path) |
| 5xx | Explicit FreeAgent server-error message (+ body detail when present) |
| Other | Uses body detail when present, else a generic status error |

## Security

- Access tokens are never logged or committed
- JWT tokens use HS256 signing with configurable secret
- PKCE is used for the OAuth authorization flow
- Strict Zod schemas reject unexpected input fields
- Bearer auth middleware protects all MCP endpoints
- Local `attachment.path` is confined to `FREEAGENT_ATTACHMENTS_DIR` (symlink-safe; default-deny when unset)
- Staged `upload_id` tokens are short-lived JWTs signed with `JWT_SECRET`; configure a bucket lifecycle rule under `UPLOAD_S3_KEY_PREFIX` for abandoned objects

## License

MIT

## Links

- [FreeAgent API Docs](https://dev.freeagent.com/docs)
- [MCP Specification](https://modelcontextprotocol.io)
- [FreeAgent Developer Dashboard](https://dev.freeagent.com)
