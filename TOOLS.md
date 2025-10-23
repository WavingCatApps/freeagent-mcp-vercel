# FreeAgent MCP Server - Tools Reference

This document provides a complete reference for all tools available in the FreeAgent MCP server.

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

**Returns:** Complete invoice details including reference, dates, amounts, line items, contact, project, comments, and status.

---

### freeagent_create_invoice

Creates a new invoice in draft status.

**Parameters:**
- `contact` (string, required): Contact URL or ID to invoice
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

**Example usage:**
```
Create an invoice for contact 123 dated 2024-01-15 with one item: consulting services, 5 hours at £100 per hour
Invoice ABC Ltd for 3 days of design work at £500 per day, dated today, due in 30 days
```

**Returns:** Success message with invoice ID, reference, total, and URL. Note that the invoice is created in Draft status and needs to be marked as Sent separately.

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

## Bank Transaction Explanations

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

## Future Tools

Additional tools that could be added:

- Project management (create, update, track)
- Bill management
- Reports (profit & loss, balance sheet)
- Categories and tax management
- Recurring invoice management

Request additional tools by opening an issue or contributing to the project!
