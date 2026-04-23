# FreeAgent MCP Server - Tools Reference

This document provides a complete reference for all tools available in the FreeAgent MCP server.

## Tool-Search Meta-Tools

Registered only when `FREEAGENT_TOOL_SEARCH=true`. In this mode the rest of the catalog below is reached through `freeagent_call_tool` rather than being exposed directly in `tools/list`.

### freeagent_search_tools

Search the FreeAgent tool catalog and return JSONSchema definitions for matching tools.

**Parameters:**
- `query` (string, required): One of:
  - `select:name1,name2` — fetch specific tools by exact name (returns every named tool)
  - `+required optional1 optional2` — require certain keywords and rank by the rest
  - plain keywords (e.g. `list invoices`, `reconcile bank transaction`) — ranked keyword search
- `max_results` (number, default: 5, max: 50): Maximum number of tool schemas to return. Ignored for `select:` queries.

**Example usage:**
```
Search the FreeAgent catalog for invoice-related tools
Load schemas for freeagent_list_invoices and freeagent_create_invoice (select:…)
```

**Returns:** A `<functions>…</functions>` block containing `<function>{description, name, parameters}</function>` entries — one per matching tool. Parameters are draft-2020-12 JSONSchema derived from the underlying Zod schema.

---

### freeagent_call_tool

Invoke a FreeAgent catalog tool by name with validated arguments. Pair with `freeagent_search_tools` to discover names and schemas.

**Parameters:**
- `name` (string, required): Exact tool name (e.g. `freeagent_list_invoices`).
- `arguments` (object, default: `{}`): Arguments matching the target tool's input schema. Validated with Zod before dispatch.

**Example usage:**
```
Call freeagent_get_company with no arguments
Call freeagent_list_invoices with { "view": "overdue", "per_page": 10 }
```

**Returns:** Whatever the underlying tool returns (Markdown or JSON depending on the `response_format` argument where supported).

---

## Contact Management

### freeagent_list_contacts

Lists all contacts in your FreeAgent account with pagination.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `sort` (string, optional): Sort by field - `created_at`, `updated_at`, `first_name`, `last_name`, `organisation_name`
- `response_format` (string, default: "markdown"): Output format - `markdown` or `json`

**Example usage:**
```
List all my contacts sorted by organization name
Show me page 2 of contacts with 50 per page
```

**Returns:** List of contacts with name, email, phone, organization, and active project count.

---

### freeagent_get_contact

Retrieves detailed information about a specific contact.

**Parameters:**
- `contact_id` (string, required): The FreeAgent contact ID (numeric) or full URL
- `response_format` (string, default: "markdown"): Output format - `markdown` or `json`

**Example usage:**
```
Get details for contact 12345
Show me full information for contact https://api.freeagent.com/v2/contacts/12345
```

**Returns:** Complete contact details including name, email, phone, address, payment terms, sales tax settings, and timestamps.

---

### freeagent_create_contact

Creates a new contact in FreeAgent.

**Parameters:**
- `first_name` (string, optional): Contact's first name
- `last_name` (string, optional): Contact's last name
- `organisation_name` (string, optional): Organization name
- `email` (string, optional): Email address
- `phone_number` (string, optional): Phone number
- `mobile` (string, optional): Mobile number
- `address1` (string, optional): Address line 1
- `town` (string, optional): Town/City
- `postcode` (string, optional): Postal code
- `country` (string, optional): Country code (e.g., GB, US)

**Note:** You must provide either `organisation_name` OR both `first_name` and `last_name`.

**Example usage:**
```
Create a contact for ABC Limited with email info@abc.com and phone 020 1234 5678
Add John Smith as a contact with email john.smith@example.com
```

**Returns:** Success message with the new contact's ID and URL.

---

## Invoice Management

### freeagent_list_invoices

Lists invoices with filtering options and pagination.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `view` (string, optional): Filter by status - `all`, `recent_open_or_overdue`, `draft`, `scheduled`, `sent`, `overdue`
- `contact` (string, optional): Filter by contact URL or ID
- `project` (string, optional): Filter by project URL or ID
- `sort` (string, optional): Sort by field - `created_at`, `updated_at`, `dated_on`, `due_on` (prefix with `-` for descending)
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all overdue invoices
List draft invoices for contact 123
Show me recent invoices sorted by due date
```

**Returns:** List of invoices with reference, status, dates, amounts, contact, and project.

---

### freeagent_get_invoice

Retrieves detailed information about a specific invoice.

**Parameters:**
- `invoice_id` (string, required): The FreeAgent invoice ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Get invoice 12345 details
Show me the complete information for invoice INV-2024-001
```

**Returns:** Complete invoice details including reference, dates, amounts, line items, contact, project, comments, and status. When a `discount_percent` is set, the markdown output also shows the computed discount amount alongside the percentage (e.g. `Discount: 20% (GBP 2365.00 off)`) — FreeAgent's API only returns the percentage, the amount is derived from `net_value`.

---

### freeagent_create_invoice

Creates a new invoice in draft status.

**Parameters:**
- `contact` (string, optional): Contact URL or ID to invoice. If omitted and the MCP client supports form elicitation, the server prompts the user with a picker of the 20 most recently-updated contacts (plus an "Other" option to paste a URL). Clients without elicitation get a clear error pointing at `freeagent_list_contacts`.
- `dated_on` (string, required): Invoice date in YYYY-MM-DD format
- `invoice_items` (array, required): Array of line items, each containing:
  - `item_type` (string): Type like "Hours", "Days", "Products"
  - `description` (string): Item description
  - `price` (string): Price per unit
  - `quantity` (string): Quantity
- `due_on` (string, optional): Due date in YYYY-MM-DD format
- `reference` (string, optional): Invoice reference number
- `currency` (string, default: "GBP"): Currency code (GBP, USD, EUR, etc.)
- `comments` (string, optional): Invoice comments/notes
- `payment_terms_in_days` (number, optional): Payment terms in days
- `discount_percent` (string, optional): Discount as a decimal string (e.g. `"20"` for 20%).

**Example usage:**
```
Create an invoice for contact 123 dated 2024-01-15 with one item: consulting services, 5 hours at £100 per hour
Invoice ABC Ltd for 3 days of design work at £500 per day, dated today, due in 30 days
Draft a 20% discounted invoice for contact 123
```

**Returns:** Success message with invoice ID, reference, total, and URL. Note that the invoice is created in Draft status — use `freeagent_transition_invoice` to mark it as Sent.

---

### freeagent_transition_invoice

Moves a FreeAgent invoice between lifecycle states. Wraps `PUT /v2/invoices/:id/transitions/:action` with no request body.

**Parameters:**
- `invoice_id` (string, required): The FreeAgent invoice ID (numeric) or full URL
- `action` (string, required): One of `mark_as_sent`, `mark_as_cancelled`, `mark_as_draft`, `mark_as_scheduled`, `convert_to_credit_note`

**Example usage:**
```
Mark invoice 123 as sent
Cancel invoice 456
Convert invoice 789 to a credit note
```

**Returns:** Success message with the new status and total.

---

### freeagent_invoice_from_timeslips

Intent bundle: drafts an invoice from a contact's unbilled timeslips in a single call. Resolves the contact by name/ID/URL, finds their active projects, collects unbilled timeslips in the date range, groups them by task using task or project billing rates, and posts a draft invoice.

**Parameters:**
- `contact` (string, required): Contact name, numeric ID, or URL. Names are resolved server-side via organisation name or first+last name.
- `project` (string, optional): Limit to a single project URL or ID. Omit to invoice across all of the contact's active projects.
- `from_date` (string, optional): Timeslips from this date onwards (YYYY-MM-DD). Defaults to the first day of the previous month.
- `to_date` (string, optional): Timeslips on or before this date (YYYY-MM-DD). Defaults to today.
- `dated_on` (string, optional): Invoice date (YYYY-MM-DD). Defaults to today.
- `due_on` (string, optional): Due date (YYYY-MM-DD).
- `reference` (string, optional): Invoice reference.
- `currency` (string, optional): Currency code. Defaults to GBP.
- `payment_terms_in_days` (number, optional): Payment terms in days.
- `discount_percent` (string, optional): Discount as a decimal string (e.g. `"20"`).
- `link_timeslips` (boolean, default: false): When true, after the invoice is drafted the tool PUTs each source timeslip with `billed_on_invoice` set. FreeAgent sometimes rejects external writes to that field; any failures are counted and listed in the response without failing the whole tool.

**Example usage:**
```
Draft this month's invoice for Acme Ltd from unbilled time
Invoice contact 123 for last month's timeslips at 20% discount and mark them as billed
Draft a monthly invoice for project 456 from unbilled time
```

**Returns:** Success message with draft invoice ID, total hours, total value, URL, and a link summary (either a DRAFT note or the count of timeslips successfully linked / failures).

---

## Company & User Information

### freeagent_get_company

Retrieves information about your FreeAgent company account.

**Parameters:**
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
What's my company information?
Show me my accounting year end date
What currency does my company use?
```

**Returns:** Company details including name, subdomain, type, currency, registration number, tax status, mileage units, and key accounting dates.

---

### freeagent_list_users

Lists all users in your FreeAgent account.

**Parameters:**
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Who has access to my FreeAgent account?
List all users with their roles
Show me user permissions
```

**Returns:** List of users with email, name, role, permission level, and URL.

---

## Response Formats

### Markdown Format (default)

Human-readable format with:
- Clear headers and sections
- Bullet lists for structured data
- Formatted dates (YYYY-MM-DD)
- Currency amounts with symbols
- Easy-to-read layouts

**Best for:** Presenting information to users, reports, summaries

**Example:**
```markdown
# Invoice: INV-2024-001

**ID**: 12345
**Status**: Sent

## Amounts
- **Net Value**: GBP 500.00
- **Sales Tax**: GBP 100.00
- **Total Value**: GBP 600.00
```

### JSON Format

Structured data format with:
- Complete field data
- Machine-readable structure
- Metadata included
- Nested objects preserved

**Best for:** Programmatic processing, data extraction, integration

**Example:**
```json
{
  "invoice": {
    "url": "https://api.freeagent.com/v2/invoices/12345",
    "reference": "INV-2024-001",
    "status": "Sent",
    "net_value": "500.00",
    "sales_tax_value": "100.00",
    "total_value": "600.00",
    "currency": "GBP"
  }
}
```

---

## Common Patterns

### Pagination

When working with large datasets:

```
# Get first page
List contacts

# Get specific page
List contacts page 2 with 50 per page

# Navigate through pages
Show me the next page of invoices
```

### Filtering

Narrow down results:

```
# By status
Show overdue invoices
List draft invoices

# By contact
Show invoices for contact 123
List contacts sorted by name
```

### Creating Records

Multi-step workflows:

```
# 1. Check if contact exists
List contacts for "ABC Limited"

# 2. Create contact if needed
Create a contact for ABC Limited with email info@abc.com

# 3. Create invoice using contact
Create an invoice for contact [ID] dated today with [items]
```

---

## Tool Annotations

All tools include metadata annotations:

- **readOnlyHint**: Whether the tool only reads data (true for list/get operations)
- **destructiveHint**: Whether the tool deletes or destroys data (false for all current tools)
- **idempotentHint**: Whether repeated calls have the same effect (true for get operations, false for create)
- **openWorldHint**: Whether the tool interacts with external systems (true for all API tools)

---

## Error Handling

All tools provide clear error messages:

| Error | Meaning | Solution |
|-------|---------|----------|
| 401 Unauthorized | Access token expired | Refresh your OAuth token |
| 403 Forbidden | Insufficient permissions | Check account permission level |
| 404 Not Found | Resource doesn't exist | Verify ID or URL is correct |
| 422 Validation Error | Invalid input data | Check required fields and formats |
| 429 Rate Limit | Too many requests | Wait 60 seconds before retrying |

---

## Best Practices

1. **Use pagination**: Don't request all records at once
2. **Filter when possible**: Use view and filter parameters to reduce result size
3. **Check before creating**: List existing records before creating new ones
4. **Use appropriate format**: Markdown for users, JSON for processing
5. **Handle errors gracefully**: Read error messages for guidance
6. **Test with sandbox**: Always test new workflows with sandbox API first

---

## Rate Limits

**Production API**: 15 requests per 60 seconds
**Sandbox API**: 5 requests per 60 seconds

The server automatically handles rate limit errors and tells you when to retry.

---

## Getting More Help

- **Full documentation**: See README.md
- **Quick setup**: See QUICKSTART.md
- **FreeAgent API docs**: https://dev.freeagent.com/docs
- **API discussion forum**: https://api-discuss.freeagent.com

---

## Expense Management

### freeagent_list_expenses

Lists expenses including regular expenses and mileage claims.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `view` (string, optional): Filter by view - `recent`, `awaiting_receipt`, `all`
- `from_date` (string, optional): Filter from date in YYYY-MM-DD format
- `to_date` (string, optional): Filter to date in YYYY-MM-DD format
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all expenses for January 2024
List expenses awaiting receipts
Show my mileage expenses
```

**Returns:** List of expenses with dates, amounts, descriptions, attachment counts, and mileage information (if applicable).

---

### freeagent_get_expense

Retrieves detailed information about a specific expense.

**Parameters:**
- `expense_id` (string, required): The FreeAgent expense ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Get expense 12345 details
Show me the receipt for expense XYZ
```

**Returns:** Complete expense details including amount, category, user, project, EC status, attachments, and mileage details (miles, vehicle type) if it's a mileage expense.

---

### freeagent_create_expense

Creates a new expense or mileage claim with optional receipt attachment.

**Parameters (Required):**
- `user` (string): User URL or ID who incurred the expense
- `category` (string): Expense category URL or ID
- `dated_on` (string): Date in YYYY-MM-DD format

**For Regular Expenses:**
- `gross_value` (string): Total amount including tax (decimal string)
- `description` (string, optional): Description of the expense
- `sales_tax_rate` (string, optional): Tax rate as decimal (e.g., '0.20' for 20%)
- `manual_sales_tax_amount` (string, optional): Manual tax amount
- `currency` (string, optional): Currency code (GBP, USD, EUR, etc.)
- `ec_status` (string, optional): 'EC Services', 'EC Goods', or 'Non-EC'
- `project` (string, optional): Project URL or ID

**For Mileage Expenses:**
- `miles` (string): Distance traveled (decimal string)
- `mileage_vehicle_type` (string, optional): 'Car', 'Motorcycle', or 'Bicycle'
- `initial_mileage` (string, optional): Starting odometer reading
- `mileage_type` (string, optional): 'Business' or 'Personal'

**For Attachments:**
- `attachment` (object, optional):
  - `data` (string): Base64 encoded file content
  - `file_name` (string): Original filename
  - `content_type` (string): `application/pdf`, `image/png`, `image/jpeg`, `image/gif`
  - `description` (string, optional): Attachment description

**Example usage:**
```
Create expense for hotel £150 with category Accommodation
Log 50 miles by car for business trip
Add receipt for taxi expense with attachment
```

**Tips:**
- Use the `file-to-base64` Claude Code skill to prepare receipt attachments
- For mileage, FreeAgent auto-calculates amounts based on HMRC rates
- Supported attachment formats: PDF, PNG, JPEG, GIF (max 5MB)

**Returns:** Success message with expense ID, date, amount, and URL.

---

### freeagent_update_expense

Updates an existing expense in FreeAgent. Only provide the fields you want to change.

**Parameters:**
- `expense_id` (string, required): The FreeAgent expense ID or full URL

All other parameters from `freeagent_create_expense` are accepted as optional overrides (e.g., `description`, `gross_value`, `category`, `dated_on`, `currency`, `ec_status`, `project`, mileage fields, recurring fields).

**Example usage:**
```
Update expense 12345 description to "Client dinner"
Change expense 12345 amount to £200
Update the category for expense 12345
```

**Returns:** Success message with updated expense details.

---

### freeagent_log_expense

Intent bundle: log a regular expense in one call. Takes a **positive** `amount` plus a `kind` enum and applies FreeAgent's sign convention server-side — removing the "use NEGATIVE values" footgun in `freeagent_create_expense`. Category accepts a name/code/URL and is resolved server-side; user defaults to the sole account user when unambiguous.

**Parameters:**
- `amount` (string, required): Expense amount as a POSITIVE decimal (e.g. `"12.50"`). The tool applies the correct sign — never pass a negative value.
- `kind` (string, default: "expense"): `"expense"` (money out of pocket) or `"refund"` (money coming back to the claimant).
- `category` (string, required): Category name (e.g. `"Travel"`), nominal code (e.g. `"285"`), or full URL. Resolved server-side with case-insensitive exact-then-substring matching; ambiguous matches surface suggestions.
- `description` (string, optional): Free-text description of the expense.
- `dated_on` (string, optional): Date in YYYY-MM-DD. Defaults to today.
- `user` (string, optional): Email, numeric ID, or URL. Defaults to the sole user on the account.
- `currency` (string, optional): Currency code.
- `sales_tax_rate` (string, optional): Decimal rate (e.g. `"0.20"` for 20%).
- `ec_status` (string, optional): Defaults to `"UK/Non-EC"`.
- `receipt_reference` (string, optional)
- `project` (string, optional): Project URL or ID.

**Not covered:** mileage claims, recurring expenses, and receipt attachments — use `freeagent_create_expense` for those.

**Example usage:**
```
Log £12.50 on Travel for Uber yesterday
Log a £40 refund on Software
Log a Travel expense against project 123
```

**Returns:** Success message with expense ID, date, amount (with the correct sign applied), category, and URL.

---

## Timeslip Management

### freeagent_list_timeslips

Lists time tracking entries with filtering and pagination.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `from_date` (string, optional): Filter from date in YYYY-MM-DD format
- `to_date` (string, optional): Filter to date in YYYY-MM-DD format
- `view` (string, optional): Filter by view - `all`, `unbilled`, `running`
- `user` (string, optional): Filter by user URL or ID
- `project` (string, optional): Filter by project URL or ID
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all unbilled timeslips
List my hours for project 123 in January
Show timeslips for user 456
```

**Returns:** List of timeslips with dates, hours, comments, billing indicators, and attachment counts.

---

### freeagent_get_timeslip

Retrieves detailed information about a specific timeslip.

**Parameters:**
- `timeslip_id` (string, required): The FreeAgent timeslip ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Get timeslip 12345 details
Check if timeslip has been billed
```

**Returns:** Complete timeslip details including hours, task, project, user, comment, billing status, and attachments.

---

### freeagent_create_timeslip

Creates a new time tracking entry with optional file attachment.

**Parameters (Required):**
- `task` (string): Task URL or ID
- `user` (string): User URL or ID who performed the work
- `project` (string): Project URL or ID
- `dated_on` (string): Date of work in YYYY-MM-DD format
- `hours` (string): Hours worked (decimal string, e.g., '7.5')

**Optional:**
- `comment` (string): Description of work performed
- `attachment` (object):
  - `data` (string): Base64 encoded file content
  - `file_name` (string): Original filename
  - `content_type` (string): MIME type
  - `description` (string, optional): Attachment description

**Example usage:**
```
Log 8 hours on project 123 task 456
Track 3.5 hours of work with supporting document
Record time worked today on development task
```

**Tips:**
- Use the `file-to-base64` Claude Code skill to prepare attachments
- Hours can be decimal values (7.5 = 7 hours 30 minutes)
- Timeslips can be included on invoices later

**Returns:** Success message with timeslip ID, date, hours, project, and URL.

---

### freeagent_update_timeslip

Updates an existing timeslip. Supports linking a timeslip to an invoice after the fact by setting `billed_on_invoice`, though FreeAgent may reject external writes to that field outside of its native "invoice from timeslips" flow — treat rejection as a soft failure.

**Parameters:**
- `timeslip_id` (string, required): The FreeAgent timeslip ID (numeric) or full URL
- `dated_on` (string, optional): Updated date (YYYY-MM-DD)
- `hours` (string, optional): Updated hours
- `comment` (string, optional): Updated comment
- `task` (string, optional): Updated task URL or ID
- `project` (string, optional): Updated project URL or ID
- `billed_on_invoice` (string, optional): Invoice URL to link this timeslip to

**Example usage:**
```
Update timeslip 12345 to 6 hours with comment "Updated scope"
Link timeslip 12345 to invoice 789
```

**Returns:** Success message with updated timeslip details (including `billed_on_invoice` when the write succeeded).

---

## Bank Account Management

### freeagent_list_bank_accounts

Lists all bank accounts in your FreeAgent account.

**Parameters:**
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all bank accounts
What's my bank balance?
Which accounts are active?
```

**Returns:** List of bank accounts with name, type, currency, current balance, and status (active/inactive).

---

### freeagent_get_bank_account

Retrieves detailed information about a specific bank account.

**Parameters:**
- `bank_account_id` (string, required): The FreeAgent bank account ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Get details for bank account 12345
Show me the IBAN for my savings account
What's the sort code for account X?
```

**Returns:** Complete bank account information including name, type, balance, banking details (account number, sort code), international details (IBAN, BIC/SWIFT), and timestamps.

---

### freeagent_list_bank_transactions

Lists bank transactions for a specific bank account with pagination and filtering.

**Parameters:**
- `bank_account` (string, required): Bank account URL or ID to list transactions for
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `from_date` (string, optional): Filter from date in YYYY-MM-DD format
- `to_date` (string, optional): Filter to date in YYYY-MM-DD format
- `view` (string, optional): Filter by explanation status - `all`, `unexplained`
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show transactions for bank account 123
List unexplained transactions
Show January transactions for account 456
Which transactions need explaining?
```

**Returns:** List of transactions with dates, amounts, descriptions, and explanation status. Unexplained transactions are marked with ⚠️, explained with ✓.

**Bank Reconciliation Workflow:**
1. List transactions with `view="unexplained"` to find items needing attention
2. Review each unexplained transaction's description and amount
3. Use `freeagent_create_bank_transaction_explanation` to categorize them
4. Link transactions to invoices, bills, or expense categories as appropriate

---

### freeagent_get_bank_transaction

Retrieves detailed information about a specific bank transaction.

**Parameters:**
- `bank_transaction_id` (string, required): The FreeAgent bank transaction ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show details for transaction 12345
Does this transaction need explaining?
```

**Returns:** Complete bank transaction details including amount, description, and explanation status.

---

## Bank Transaction Explanations

### freeagent_list_bank_transaction_explanations

Lists bank transaction explanations showing how transactions were categorized or linked to invoices, bills, or transfers.

**Parameters:**
- `bank_account` (string, optional): Filter by bank account URL or ID
- `from_date` (string, optional): Filter from date in YYYY-MM-DD format
- `to_date` (string, optional): Filter to date in YYYY-MM-DD format
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show all bank transaction explanations
List explanations for account 123
Show explanations from January
```

**Returns:** List of explanations with dates, amounts, descriptions, categorization details, and review status.

---

### freeagent_get_bank_transaction_explanation

Retrieves detailed information about a specific bank transaction explanation.

**Parameters:**
- `bank_transaction_explanation_id` (string, required): The FreeAgent explanation ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show details for explanation 456
What category was assigned to this explanation?
```

**Returns:** Complete explanation details including categorization, tax info, and linked entities (invoices, bills, transfers).

---

### freeagent_create_bank_transaction_explanation

Explains (categorizes) a bank transaction by linking it to invoices, bills, or categories.

**Parameters (Required):**
- `bank_transaction` (string): Bank transaction URL or ID
- `dated_on` (string): Transaction date in YYYY-MM-DD format
- `gross_value` (string): Amount as decimal string (negative for debits)

**Optional:**
- `description` (string): Transaction description
- `category` (string): Category URL or ID

**Link to Entities:**
- `paid_invoice` (string): Invoice this transaction pays
- `paid_bill` (string): Bill this transaction pays
- `paid_user` (string): User for money paid to/from
- `transfer_bank_account` (string): Destination account for transfers
- `project` (string): Associated project

**Tax Information:**
- `sales_tax_rate` (string): Tax rate as decimal
- `sales_tax_value` (string): Tax amount

**Attachment:**
- `attachment` (object): Supporting document (same format as expenses)

**Example usage:**
```
Mark transaction 789 as payment for invoice 123
Explain transaction as bill payment with receipt
Categorize as transfer between accounts
Link bank transaction to expense category
```

**Tips:**
- Essential for bank reconciliation and accurate bookkeeping
- Link to invoices/bills for automatic matching
- Use categories for general income/expenses

**Returns:** Success message with explanation ID, date, amount, and explanation type (invoice payment, bill payment, transfer, etc.).

---

### freeagent_update_bank_transaction_explanation

Updates an existing bank transaction explanation. Only provide the fields you want to change.

**Parameters:**
- `bank_transaction_explanation_id` (string, required): The FreeAgent explanation ID or full URL

All other parameters from `freeagent_create_bank_transaction_explanation` are accepted as optional overrides (e.g., `dated_on`, `description`, `gross_value`, `category`, `paid_invoice`, `paid_bill`, `sales_tax_rate`, `transfer_bank_account`).

**Example usage:**
```
Update explanation 456 description to "Monthly rent"
Change the category for explanation 456
Link explanation to a different invoice
```

**Returns:** Success message with updated explanation details.

---

### freeagent_reconcile_bank_transaction

Intent bundle: explain a bank transaction in one call. Accepts a human-friendly hint (category name, nominal code, invoice reference, or bill reference) and resolves it to the correct FreeAgent URL server-side. Auto-fills date and amount from the transaction, so you don't need to call `get_bank_transaction` or `list_categories` first. Provide **exactly one** of `category`, `paid_invoice`, or `paid_bill`.

**Parameters:**
- `bank_transaction_id` (string, required): The bank transaction URL or numeric ID.
- `category` (string, optional): Category name (e.g. `"Travel"`), nominal code (e.g. `"285"`), or URL.
- `paid_invoice` (string, optional): Invoice reference (e.g. `"INV-001"`), numeric ID, or URL.
- `paid_bill` (string, optional): Supplier bill reference, numeric ID, or URL.
- `description` (string, optional): Free-text description for the explanation.
- `marked_for_review` (boolean, optional): Flag the explanation for human review (e.g. when the match is a guess).
- `receipt_reference` (string, optional): Receipt or transaction reference identifier.

**Resolution:**
- URL → used as-is
- Numeric ID → fetched directly for a canonical URL
- Name/reference → list + match; ambiguous matches surface suggestions in the error message

**Example usage:**
```
Explain transaction 789 as Travel
Mark transaction 789 as paying invoice INV-001
Explain transaction 789 as paying bill SUP-99
```

**Returns:** Success message with the new explanation ID, date, amount, and linked entity (category / paid invoice / paid bill).

---

## Working with Attachments

### Overview

Expenses, timeslips, and bank transaction explanations support file attachments for receipts, invoices, and supporting documents.

### Supported Formats

- **PDF**: `application/pdf`
- **PNG**: `image/png`
- **JPEG**: `image/jpeg`
- **GIF**: `image/gif`

**Maximum file size**: 5MB per attachment

### Using the file-to-base64 Skill

Claude Code includes a `file-to-base64` skill in `.claude/skills/file-to-base64/` that helps prepare attachments by:

- Validating file format and size
- Converting files to Base64
- Detecting MIME types automatically
- Checking file permissions

Simply provide the file path when creating expenses, timeslips, or explanations, and Claude will use the skill to prepare the attachment.

### Manual Preparation (if needed)

```bash
# Convert file to Base64
base64 /path/to/file.pdf

# Check file size (must be < 5MB = 5242880 bytes)
stat -f%z /path/to/file.pdf  # macOS
stat -c%s /path/to/file.pdf  # Linux
```

### Best Practices

1. **Compress large images** before uploading
2. **Use descriptive filenames** for easy identification
3. **Add descriptions** to explain what the attachment shows
4. **Check file size** - must be under 5MB
5. **Use appropriate formats** - PDF for documents, PNG/JPEG for photos

---

## Project Management

### freeagent_list_projects

Lists all projects in your FreeAgent account with filtering and pagination.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `view` (string, optional): Filter by status - `active`, `completed`, `cancelled`, `all`
- `contact` (string, optional): Filter by contact URL or ID
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all active projects
List projects for contact 123
```

**Returns:** List of projects with name, contact, status, budget, currency, dates, and billing rate.

---

### freeagent_get_project

Retrieves detailed information about a specific project.

**Parameters:**
- `project_id` (string, required): The FreeAgent project ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Get project 12345 details
Show me the billing rate for project X
```

**Returns:** Complete project details including name, contact, status, budget, currency, dates, billing rate, IR35 status, and timestamps.

---

### freeagent_create_project

Creates a new project in FreeAgent.

**Parameters (Required):**
- `contact` (string): Contact URL or ID this project is for
- `name` (string): Name of the project
- `budget` (string): Budget amount (decimal string)
- `budget_units` (string): Budget units - `Hours`, `Days`, or `Monetary`
- `status` (string, default: "Active"): Project status - `Active`, `Completed`, `Cancelled`, `Hidden`

**Optional:**
- `currency` (string, default: "GBP"): Currency code (GBP, USD, EUR, etc.)
- `starts_on` (string): Start date in YYYY-MM-DD format
- `ends_on` (string): End date in YYYY-MM-DD format
- `normal_billing_rate` (string): Billing rate (decimal string)
- `billing_period` (string): `hour` or `day`
- `hours_per_day` (string, default: "8"): Hours per working day
- `is_ir35` (boolean, default: false): Whether subject to IR35
- `uses_project_invoice_sequence` (boolean, default: false): Use project-specific invoice numbering
- `contract_po_reference` (string): Purchase order reference
- `include_unbilled_time_in_profitability` (boolean): Include unbilled time in profit calculations

**Example usage:**
```
Create a project for contact 123 called "Website Redesign" with 100 hours budget
Add a new project for ABC Ltd with daily billing at £500
```

**Returns:** Success message with project name, URL, contact, status, budget, and currency.

---

## Task Management

### freeagent_list_tasks

Lists tasks in your FreeAgent account with filtering and pagination.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `view` (string, optional): Filter by status - `active`, `completed`, `hidden`, `all`
- `project` (string, optional): Filter by project URL or ID
- `updated_since` (string, optional): Filter by last update timestamp (ISO 8601)
- `sort` (string, optional): Sort by field - `name`, `project`, `billing_rate`, `created_at`, `updated_at`
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all active tasks
List tasks for project 123
```

**Returns:** List of tasks with name, project, status, billable flag, billing rate, and currency.

---

### freeagent_get_task

Retrieves detailed information about a specific task.

**Parameters:**
- `task_id` (string, required): The FreeAgent task ID or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Get task 12345 details
Check the billing rate for task X
```

**Returns:** Complete task details including name, project, status, billable flag, billing rate, billing period, currency, and timestamps.

---

### freeagent_create_task

Creates a new task within a project in FreeAgent.

**Parameters (Required):**
- `project` (string): Project URL or ID this task belongs to
- `name` (string): Name of the task

**Optional:**
- `is_billable` (boolean, default: true): Whether this task is billable
- `status` (string, default: "Active"): Task status - `Active`, `Completed`, `Hidden`
- `billing_rate` (string): Billing rate (decimal string)
- `billing_period` (string): `hour` or `day`

**Example usage:**
```
Create a task called "Development" for project 123
Add a non-billable task for project X
```

**Returns:** Success message with task name, URL, project, status, and billing details.

---

## Category Management

### freeagent_list_categories

Lists all categories in your FreeAgent account for expenses, invoices, and transactions.

**Parameters:**
- `view` (string, optional): Filter by type - `all`, `standard` (system categories), `custom` (user-created)
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all expense categories
List standard categories
What custom categories do I have?
```

**Returns:** List of categories grouped by type (Admin Expenses, Cost of Sales, Income, General) with description, nominal code, tax settings, and group information.

---

### freeagent_get_category

Retrieves detailed information about a specific category by nominal code.

**Parameters:**
- `nominal_code` (string, required): The FreeAgent category nominal code or full URL
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Get category 285 details
What tax rate applies to category X?
```

**Returns:** Complete category details including description, nominal code, group, tax allowability, tax reporting name, auto sales tax rate, and timestamps.

---

## Bill Management

### freeagent_list_bills

Lists supplier bills with filtering and pagination.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `view` (string, optional): Filter by status - `recent`, `open`, `overdue`, `paid`, `all`
- `contact` (string, optional): Filter by contact (supplier) URL or ID
- `from_date` (string, optional): Filter bills dated on or after this date (YYYY-MM-DD)
- `to_date` (string, optional): Filter bills dated on or before this date (YYYY-MM-DD)
- `sort` (string, optional): Sort by `created_at`, `updated_at`, `dated_on`, `due_on` (prefix with `-` for descending)
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
List open bills
Show overdue bills for supplier 123
```

**Returns:** List of bills with date, total, reference, contact, status, and due date.

---

### freeagent_get_bill

Retrieves detailed information about a specific supplier bill.

**Parameters:**
- `bill_id` (string, required): The FreeAgent bill ID (numeric) or full URL
- `response_format` (string, default: "markdown"): Output format

**Returns:** Complete bill details including date, totals, reference, contact, status, paid/outstanding amounts, and line items.

---

### freeagent_create_bill

Creates a new supplier bill to record money owed.

**Parameters (Required):**
- `contact` (string): Supplier contact URL or ID
- `dated_on` (string): Bill date in YYYY-MM-DD format
- `bill_items` (array): Line items, each containing:
  - `category` (string): Category URL or nominal code
  - `description` (string, optional): Line description
  - `price` (string): Unit price
  - `quantity` (string): Quantity
  - `sales_tax_rate` (string, optional): e.g. `"0.20"` for 20%

**Optional:**
- `due_on` (string): Due date (YYYY-MM-DD)
- `reference` (string): Supplier's invoice reference
- `currency` (string): Currency code
- `comments` (string): Internal comments
- `payment_terms_in_days` (number)
- `ec_status` (string): Defaults to `"UK/Non-EC"`

**Example usage:**
```
Record a bill for supplier 123 for £500 software subscription
Create a bill from supplier's invoice SUP-99 dated today
```

**Returns:** Success message with bill ID, date, total, reference, contact, and URL.

---

## Estimate Management

### freeagent_list_estimates

Lists estimates (quotes) with filtering and pagination.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `view` (string, optional): Filter by status - `all`, `draft`, `sent`, `approved`, `rejected`, `cancelled`, `invoiced`
- `contact` (string, optional): Filter by contact URL or ID
- `project` (string, optional): Filter by project URL or ID
- `sort` (string, optional): Sort by `created_at`, `updated_at`, `dated_on` (prefix with `-` for descending)
- `response_format` (string, default: "markdown"): Output format

**Example usage:**
```
Show me all sent estimates
List draft estimates for contact 123
```

**Returns:** List of estimates with date, total, reference, status, contact, and expiry.

---

### freeagent_get_estimate

Retrieves detailed information about a specific estimate.

**Parameters:**
- `estimate_id` (string, required): The FreeAgent estimate ID (numeric) or full URL
- `response_format` (string, default: "markdown"): Output format

**Returns:** Complete estimate details including date, expiry, reference, status, contact, total, discount (percent and computed amount when > 0), comments, and line items.

---

### freeagent_create_estimate

Drafts a new estimate for a contact.

**Parameters (Required):**
- `contact` (string): Contact URL or ID
- `dated_on` (string): Estimate date (YYYY-MM-DD)
- `estimate_items` (array): Line items, same shape as invoice items (`item_type`, `description`, `price`, `quantity`, optional `sales_tax_rate`)

**Optional:**
- `expires_on` (string): Expiry date (YYYY-MM-DD)
- `reference` (string): Estimate reference (e.g. `"EST-001"`)
- `currency` (string, default: "GBP"): Currency code
- `comments` (string): Comments shown on the estimate
- `terms_and_conditions` (string): Terms & conditions text
- `payment_terms_in_days` (number)
- `discount_percent` (string): Discount as a decimal string (e.g. `"20"`)
- `ec_status` (string): Defaults to `"UK/Non-EC"`

**Example usage:**
```
Draft an estimate for contact 123 with two items: design work 5 days at £500, implementation 10 days at £400
```

**Returns:** Success message with estimate ID, date, reference, total, contact, and URL.

---

### freeagent_transition_estimate

Moves an estimate through its lifecycle. Wraps `PUT /v2/estimates/:id/transitions/:action` with no request body.

**Parameters:**
- `estimate_id` (string, required): The FreeAgent estimate ID (numeric) or full URL
- `action` (string, required): One of `mark_as_sent`, `mark_as_approved`, `mark_as_rejected`, `mark_as_cancelled`, `mark_as_draft`, `convert_to_invoice`

**Example usage:**
```
Mark estimate 45 as sent
Mark estimate 45 as approved after the client accepted
Convert estimate 45 into an invoice
```

**Returns:** Success message with the new status and total.

---

## Recurring Invoices

### freeagent_list_recurring_invoices

Lists recurring invoice templates.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `view` (string, optional): `all`, `active`, `cancelled`
- `contact` (string, optional): Filter by contact URL or ID
- `response_format` (string, default: "markdown"): Output format

**Returns:** List of recurring invoices with reference, contact, frequency, next run date, end date, status, and total.

---

### freeagent_get_recurring_invoice

Retrieves a specific recurring invoice template.

**Parameters:**
- `recurring_invoice_id` (string, required): The FreeAgent recurring invoice ID (numeric) or full URL
- `response_format` (string, default: "markdown"): Output format

**Returns:** Complete details including contact, reference, frequency, next run date, end date, status, total, and line items.

**Note:** Writes (create/update/delete) on recurring invoices are intentionally not exposed — the template shape is intricate and the flow is better handled in the FreeAgent UI.

---

## Price List Items

### freeagent_list_price_list_items

Lists price list (catalog) items.

**Parameters:**
- `page` (number, default: 1): Page number for pagination
- `per_page` (number, default: 25, max: 100): Items per page
- `response_format` (string, default: "markdown"): Output format

**Returns:** List of price list items with description, type, price, and ID.

---

### freeagent_get_price_list_item

Retrieves a specific price list item.

**Parameters:**
- `price_list_item_id` (string, required): The FreeAgent price list item ID (numeric) or full URL
- `response_format` (string, default: "markdown"): Output format

**Returns:** Description, type, price, sales tax rate, and category.

---

### freeagent_create_price_list_item

Creates a new catalog item reusable on invoices and estimates.

**Parameters:**
- `description` (string, required): Item description
- `price` (string, required): Unit price
- `item_type` (string, default: "Products"): e.g. `"Products"`, `"Hours"`, `"Days"`
- `sales_tax_rate` (string, optional): Decimal rate (e.g. `"0.20"` for 20%)
- `category` (string, optional): Category URL or nominal code

**Example usage:**
```
Add a "Consulting hour" at £120 to the price list
Create a "Retainer" product at £2000
```

**Returns:** Success message with the new price list item ID, description, type, price, and URL.

---

## Intent Bundles at a Glance

Intent bundles are cross-resource tools that collapse a multi-call sequence into one agent-visible call. They are documented inline next to the primitives they replace:

| Bundle | Replaces | Location |
|---|---|---|
| `freeagent_reconcile_bank_transaction` | `get_bank_transaction` → `list_categories`/`list_invoices`/`list_bills` → `create_bank_transaction_explanation` | [Bank Transaction Explanations](#bank-transaction-explanations) |
| `freeagent_log_expense` | `list_categories` → `list_users` → `create_expense` (with correct sign) | [Expense Management](#expense-management) |
| `freeagent_invoice_from_timeslips` | `list_projects` → `list_timeslips` → `get_task` (per task) → `create_invoice` → `update_timeslip` (per timeslip) | [Invoice Management](#invoice-management) |

All three resolve human-friendly hints (names, codes, references) to canonical FreeAgent URLs server-side, and surface suggestion-rich errors when a hint is ambiguous or matches nothing.
