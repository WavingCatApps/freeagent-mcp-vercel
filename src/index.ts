/**
 * FreeAgent MCP Server
 * 
 * This server provides MCP tools for interacting with the FreeAgent accounting API.
 * It supports OAuth 2.0 authentication and provides access to contacts, invoices,
 * expenses, projects, bank accounts, and company information.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FreeAgentApiClient, formatErrorForLLM } from "./services/api-client.js";
import { listContacts, getContact, createContact } from "./tools/contacts.js";
import { listInvoices, getInvoice, createInvoice } from "./tools/invoices.js";
import { listExpenses, getExpense, createExpense } from "./tools/expenses.js";
import { listTimeslips, getTimeslip, createTimeslip } from "./tools/timeslips.js";
import { listBankAccounts, getBankAccount, listBankTransactions } from "./tools/bank-accounts.js";
import { createBankTransactionExplanation } from "./tools/bank-transactions.js";
import { getCompany, listUsers } from "./tools/company.js";
import {
  ListContactsInputSchema,
  GetContactInputSchema,
  CreateContactInputSchema,
  ListInvoicesInputSchema,
  GetInvoiceInputSchema,
  CreateInvoiceInputSchema,
  ListExpensesInputSchema,
  GetExpenseInputSchema,
  CreateExpenseInputSchema,
  ListTimeslipsInputSchema,
  GetTimeslipInputSchema,
  CreateTimeslipInputSchema,
  ListBankAccountsInputSchema,
  GetBankAccountInputSchema,
  ListBankTransactionsInputSchema,
  CreateBankTransactionExplanationInputSchema,
  GetCompanyInputSchema,
  ListUsersInputSchema,
  type ListContactsInput,
  type GetContactInput,
  type CreateContactInput,
  type ListInvoicesInput,
  type GetInvoiceInput,
  type CreateInvoiceInput,
  type ListExpensesInput,
  type GetExpenseInput,
  type CreateExpenseInput,
  type ListTimeslipsInput,
  type GetTimeslipInput,
  type CreateTimeslipInput,
  type ListBankAccountsInput,
  type GetBankAccountInput,
  type ListBankTransactionsInput,
  type CreateBankTransactionExplanationInput,
  type GetCompanyInput,
  type ListUsersInput
} from "./schemas/index.js";

// Initialize MCP server
const server = new McpServer({
  name: "freeagent-mcp-server",
  version: "1.0.0"
});

// Get configuration from environment
const ACCESS_TOKEN = process.env.FREEAGENT_ACCESS_TOKEN;
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";

// Initialize API client (will be set after validation)
let apiClient: FreeAgentApiClient;

/**
 * Tool: freeagent_list_contacts
 * List all contacts with pagination and optional sorting
 */
server.registerTool(
  "freeagent_list_contacts",
  {
    title: "List FreeAgent Contacts",
    description: `List all contacts in your FreeAgent account with pagination support.

This tool retrieves contacts (customers, suppliers, and other business contacts) from FreeAgent. Contacts can be sorted by various fields and results are paginated.

Args:
  - page (number): Page number for pagination, starts at 1 (default: 1)
  - per_page (number): Number of items per page, max 100 (default: 25)
  - sort (string): Optional field to sort by - one of: created_at, updated_at, first_name, last_name, organisation_name
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "contacts": [
      {
        "url": string,              // Contact URL
        "first_name": string,       // First name (optional)
        "last_name": string,        // Last name (optional)
        "organisation_name": string, // Organisation name (optional)
        "email": string,            // Email address (optional)
        "phone_number": string,     // Phone number (optional)
        "active_projects_count": number // Active project count
      }
    ],
    "pagination": {
      "page": number,
      "per_page": number,
      "total_count": number,
      "has_more": boolean,
      "next_page": number
    }
  }

  For Markdown format: Human-readable formatted list of contacts with key details.

Examples:
  - Use when: "Show me all my contacts" → list with default pagination
  - Use when: "Find contacts sorted by name" → use sort="first_name"
  - Use when: "Show me page 2 of contacts" → use page=2

Error Handling:
  - Returns rate limit error (429) if exceeding 15 requests per 60 seconds
  - Returns authentication error (401) if access token is expired
  - Suggests using pagination if results are truncated`,
    inputSchema: ListContactsInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListContactsInput) => {
    try {
      const result = await listContacts(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_get_contact
 * Get detailed information about a specific contact
 */
server.registerTool(
  "freeagent_get_contact",
  {
    title: "Get FreeAgent Contact Details",
    description: `Retrieve detailed information about a specific contact by ID.

This tool fetches complete details for a single contact, including contact information, address, and account settings.

Args:
  - contact_id (string): The FreeAgent contact ID (numeric) or full URL
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Complete contact information including name, email, phone, address, payment terms, and metadata.

Examples:
  - Use when: "Get details for contact 12345" → contact_id="12345"
  - Use when: "Show me contact information for John Doe" → first list contacts, then get specific one

Error Handling:
  - Returns 404 error if contact ID doesn't exist
  - Returns authentication error if token is expired`,
    inputSchema: GetContactInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetContactInput) => {
    try {
      const result = await getContact(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_create_contact
 * Create a new contact
 */
server.registerTool(
  "freeagent_create_contact",
  {
    title: "Create FreeAgent Contact",
    description: `Create a new contact in FreeAgent.

This tool creates a new customer, supplier, or business contact in your FreeAgent account. At minimum, you should provide either organisation_name or both first_name and last_name.

Args:
  - first_name (string): Contact's first name (optional)
  - last_name (string): Contact's last name (optional)
  - organisation_name (string): Organisation name (optional)
  - email (string): Email address (optional)
  - phone_number (string): Phone number (optional)
  - mobile (string): Mobile number (optional)
  - address1 (string): Address line 1 (optional)
  - town (string): Town/City (optional)
  - postcode (string): Postal code (optional)
  - country (string): Country code, e.g., GB, US (optional)

Returns:
  Success message with the created contact's ID and URL.

Examples:
  - Use when: "Create a contact for ABC Ltd" → organisation_name="ABC Ltd", email="..."
  - Use when: "Add John Smith as a customer" → first_name="John", last_name="Smith"

Error Handling:
  - Returns validation errors (422) if required fields are missing
  - Suggests providing at least organisation_name or first_name/last_name`,
    inputSchema: CreateContactInputSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: CreateContactInput) => {
    try {
      const result = await createContact(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_list_invoices
 * List invoices with filtering and pagination
 */
server.registerTool(
  "freeagent_list_invoices",
  {
    title: "List FreeAgent Invoices",
    description: `List invoices in your FreeAgent account with filtering and pagination.

This tool retrieves invoices with various filter options including status, contact, project, and date ranges.

Args:
  - page (number): Page number for pagination (default: 1)
  - per_page (number): Items per page, max 100 (default: 25)
  - view (string): Filter by status - one of: all, recent_open_or_overdue, draft, scheduled, sent, overdue (optional)
  - contact (string): Filter by contact URL or ID (optional)
  - project (string): Filter by project URL or ID (optional)
  - sort (string): Sort by field: created_at, updated_at, dated_on, due_on (prefix with '-' for descending) (optional)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured list of invoices with pagination metadata.
  For Markdown format: Human-readable invoice list with status, dates, amounts, and contacts.

Examples:
  - Use when: "Show me all overdue invoices" → view="overdue"
  - Use when: "List invoices for contact 123" → contact="123"
  - Use when: "Show draft invoices sorted by date" → view="draft", sort="dated_on"

Error Handling:
  - Returns rate limit error if too many requests
  - Suggests using view parameter to filter large result sets`,
    inputSchema: ListInvoicesInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListInvoicesInput) => {
    try {
      const result = await listInvoices(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_get_invoice
 * Get detailed invoice information
 */
server.registerTool(
  "freeagent_get_invoice",
  {
    title: "Get FreeAgent Invoice Details",
    description: `Retrieve detailed information about a specific invoice.

This tool fetches complete details for a single invoice including line items, amounts, status, and related information.

Args:
  - invoice_id (string): The FreeAgent invoice ID (numeric) or full URL
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Complete invoice information including reference, dates, amounts, line items, contact, and status.

Examples:
  - Use when: "Get invoice 12345 details" → invoice_id="12345"
  - Use when: "Show me the line items for invoice INV-001" → first find invoice, then get details

Error Handling:
  - Returns 404 if invoice doesn't exist`,
    inputSchema: GetInvoiceInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetInvoiceInput) => {
    try {
      const result = await getInvoice(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_create_invoice
 * Create a new invoice
 */
server.registerTool(
  "freeagent_create_invoice",
  {
    title: "Create FreeAgent Invoice",
    description: `Create a new invoice in FreeAgent.

This tool creates a new invoice in Draft status. The invoice must have at least one line item and be associated with a contact.

Args:
  - contact (string): Contact URL or ID to invoice (required)
  - dated_on (string): Invoice date in YYYY-MM-DD format (required)
  - invoice_items (array): Array of line items, each with item_type, description, price, quantity (required)
  - due_on (string): Due date in YYYY-MM-DD format (optional)
  - reference (string): Invoice reference number (optional)
  - currency (string): Currency code - GBP, USD, EUR, etc. (default: GBP)
  - comments (string): Invoice comments (optional)
  - payment_terms_in_days (number): Payment terms in days (optional)

Returns:
  Success message with invoice ID, reference, total, and URL. Note that invoice is created in Draft status.

Examples:
  - Use when: "Create invoice for contact 123" → contact="123", dated_on="2024-01-15", invoice_items=[...]
  - Use when: "Invoice ABC Ltd for consulting" → contact with organisation_name, line items

Error Handling:
  - Returns validation errors if required fields missing or invalid
  - Returns 404 if contact doesn't exist
  - Suggests ensuring contact exists first`,
    inputSchema: CreateInvoiceInputSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: CreateInvoiceInput) => {
    try {
      const result = await createInvoice(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_list_expenses
 * List expenses with filtering and pagination
 */
server.registerTool(
  "freeagent_list_expenses",
  {
    title: "List FreeAgent Expenses",
    description: `List expenses in your FreeAgent account with filtering and pagination.

This tool retrieves business expenses including regular expenses and mileage claims. Expenses can be filtered by date range and view status, with support for pagination.

Args:
  - page (number): Page number for pagination (default: 1)
  - per_page (number): Items per page, max 100 (default: 25)
  - view (string): Filter by view - one of: recent, awaiting_receipt, all (optional)
  - from_date (string): Filter expenses from this date in YYYY-MM-DD format (optional)
  - to_date (string): Filter expenses to this date in YYYY-MM-DD format (optional)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured list of expenses with details including amounts, categories, mileage info, and attachments.
  For Markdown format: Human-readable expense list with dates, amounts, descriptions, and attachment counts.

Examples:
  - Use when: "Show me all expenses for January 2024" → from_date="2024-01-01", to_date="2024-01-31"
  - Use when: "List expenses awaiting receipts" → view="awaiting_receipt"
  - Use when: "Show my mileage expenses" → list all and filter by miles field

Error Handling:
  - Returns rate limit error if too many requests
  - Suggests using date filters to narrow results`,
    inputSchema: ListExpensesInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListExpensesInput) => {
    try {
      const result = await listExpenses(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_get_expense
 * Get detailed information about a specific expense
 */
server.registerTool(
  "freeagent_get_expense",
  {
    title: "Get FreeAgent Expense Details",
    description: `Retrieve detailed information about a specific expense by ID.

This tool fetches complete details for a single expense, including amount, category, description, attachments, and mileage information if applicable.

Args:
  - expense_id (string): The FreeAgent expense ID (numeric) or full URL
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Complete expense information including date, amount, category, user, project, EC status, attachments, and mileage details (miles, vehicle type) if it's a mileage expense.

Examples:
  - Use when: "Get expense 12345 details" → expense_id="12345"
  - Use when: "Show me the receipt for expense XYZ" → first get expense, check attachment_count

Error Handling:
  - Returns 404 if expense doesn't exist`,
    inputSchema: GetExpenseInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetExpenseInput) => {
    try {
      const result = await getExpense(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_create_expense
 * Create a new expense (regular or mileage)
 */
server.registerTool(
  "freeagent_create_expense",
  {
    title: "Create FreeAgent Expense",
    description: `Create a new expense in FreeAgent, including regular expenses or mileage claims.

This tool creates business expenses with optional receipt attachments. You can create either regular expenses (with gross_value) or mileage expenses (with miles and vehicle_type fields).

Args:
  - user (string): User URL or ID who incurred the expense (required)
  - category (string): Expense category URL or ID (required)
  - dated_on (string): Date of expense in YYYY-MM-DD format (required)
  - description (string): Description of the expense (optional)
  - gross_value (string): Total amount including tax (decimal string, required for non-mileage)
  - sales_tax_rate (string): Sales tax rate as decimal, e.g., '0.20' for 20% (optional)
  - manual_sales_tax_amount (string): Manual sales tax amount (optional)
  - currency (string): Currency code - GBP, USD, EUR, etc. (optional)
  - ec_status (string): One of: 'EC Services', 'EC Goods', 'Non-EC' (optional)
  - project (string): Project URL or ID to associate with expense (optional)
  - attachment (object): File attachment for receipt (optional):
    - data (string): Base64 encoded file content
    - file_name (string): Original filename
    - content_type (string): MIME type - application/pdf, image/png, image/jpeg, image/gif
    - description (string): Optional attachment description

  Mileage-specific fields (use instead of gross_value):
  - miles (string): Distance traveled in miles (decimal string, required for mileage)
  - mileage_vehicle_type (string): One of: 'Car', 'Motorcycle', 'Bicycle' (optional)
  - initial_mileage (string): Starting odometer reading (optional)
  - mileage_type (string): One of: 'Business', 'Personal' (optional)

Returns:
  Success message with expense ID, date, amount, and URL. For mileage expenses, includes miles traveled.

Examples:
  - Use when: "Create expense for hotel £150" → gross_value="150.00", category="Accommodation"
  - Use when: "Log 50 miles by car" → miles="50", mileage_vehicle_type="Car"
  - Use when: "Add receipt for taxi expense" → Include attachment with Base64 data

Tips:
  - Use the file-to-base64 skill to prepare receipt attachments from image/PDF files
  - For mileage expenses, provide miles instead of gross_value
  - FreeAgent will auto-calculate mileage expenses based on HMRC rates

Error Handling:
  - Returns validation errors (422) if required fields missing
  - Returns 404 if user or category doesn't exist
  - Suggests ensuring user and category exist first`,
    inputSchema: CreateExpenseInputSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: CreateExpenseInput) => {
    try {
      const result = await createExpense(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_list_timeslips
 * List timeslips with filtering and pagination
 */
server.registerTool(
  "freeagent_list_timeslips",
  {
    title: "List FreeAgent Timeslips",
    description: `List timeslips in your FreeAgent account with filtering and pagination.

This tool retrieves time tracking entries (timeslips) for projects. Timeslips can be filtered by date range, user, project, and billing status.

Args:
  - page (number): Page number for pagination (default: 1)
  - per_page (number): Items per page, max 100 (default: 25)
  - from_date (string): Filter timeslips from this date in YYYY-MM-DD format (optional)
  - to_date (string): Filter timeslips to this date in YYYY-MM-DD format (optional)
  - view (string): Filter by view - one of: all, unbilled, running (optional)
  - user (string): Filter by user URL or ID (optional)
  - project (string): Filter by project URL or ID (optional)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured list of timeslips with hours, dates, projects, tasks, and billing status.
  For Markdown format: Human-readable timeslip list with dates, hours, comments, and billing indicators.

Examples:
  - Use when: "Show me all unbilled timeslips" → view="unbilled"
  - Use when: "List my hours for project 123 in January" → project="123", from_date="2024-01-01", to_date="2024-01-31"
  - Use when: "Show timeslips for user 456" → user="456"

Error Handling:
  - Returns rate limit error if too many requests
  - Suggests using filters to narrow results`,
    inputSchema: ListTimeslipsInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListTimeslipsInput) => {
    try {
      const result = await listTimeslips(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_get_timeslip
 * Get detailed information about a specific timeslip
 */
server.registerTool(
  "freeagent_get_timeslip",
  {
    title: "Get FreeAgent Timeslip Details",
    description: `Retrieve detailed information about a specific timeslip by ID.

This tool fetches complete details for a single timeslip, including hours, task, project, user, and billing information.

Args:
  - timeslip_id (string): The FreeAgent timeslip ID (numeric) or full URL
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Complete timeslip information including date, hours, user, project, task, comment, billing status, and attachments.

Examples:
  - Use when: "Get timeslip 12345 details" → timeslip_id="12345"
  - Use when: "Check if timeslip has been billed" → get timeslip, check billed_on_invoice field

Error Handling:
  - Returns 404 if timeslip doesn't exist`,
    inputSchema: GetTimeslipInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetTimeslipInput) => {
    try {
      const result = await getTimeslip(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_create_timeslip
 * Create a new timeslip
 */
server.registerTool(
  "freeagent_create_timeslip",
  {
    title: "Create FreeAgent Timeslip",
    description: `Create a new timeslip (time tracking entry) in FreeAgent.

This tool records time worked on a project task. You can optionally attach supporting files to the timeslip.

Args:
  - task (string): Task URL or ID (required)
  - user (string): User URL or ID who performed the work (required)
  - project (string): Project URL or ID (required)
  - dated_on (string): Date of work in YYYY-MM-DD format (required)
  - hours (string): Hours worked as decimal string, e.g., '7.5' (required)
  - comment (string): Description or comment about the work performed (optional)
  - attachment (object): Optional file attachment for the timeslip:
    - data (string): Base64 encoded file content
    - file_name (string): Original filename
    - content_type (string): MIME type - application/pdf, image/png, image/jpeg, image/gif
    - description (string): Optional attachment description

Returns:
  Success message with timeslip ID, date, hours, project, and URL.

Examples:
  - Use when: "Log 8 hours on project 123 task 456" → hours="8", project="123", task="456"
  - Use when: "Track 3.5 hours of work with attachment" → hours="3.5", include attachment with Base64 data
  - Use when: "Record time worked today" → dated_on=today's date, hours="..."

Tips:
  - Use the file-to-base64 skill to prepare attachments from files
  - Hours can be decimal values (e.g., 7.5 for 7 hours 30 minutes)
  - Timeslips can later be included on invoices

Error Handling:
  - Returns validation errors (422) if required fields missing
  - Returns 404 if project, task, or user doesn't exist
  - Suggests ensuring project and task exist first`,
    inputSchema: CreateTimeslipInputSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: CreateTimeslipInput) => {
    try {
      const result = await createTimeslip(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_list_bank_accounts
 * List all bank accounts
 */
server.registerTool(
  "freeagent_list_bank_accounts",
  {
    title: "List FreeAgent Bank Accounts",
    description: `List all bank accounts in your FreeAgent account.

This tool retrieves all bank accounts including current accounts, savings accounts, and credit cards. Each account shows its current balance, currency, and status (active/inactive).

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with array of bank accounts including:
  {
    "bank_accounts": [
      {
        "url": string,              // Bank account URL
        "name": string,             // Account name
        "type": string,             // Account type (e.g., StandardBankAccount, CreditCardAccount)
        "currency": string,         // Currency code (GBP, USD, EUR, etc.)
        "current_balance": string,  // Current balance as decimal string
        "is_active": boolean,       // Whether account is active
        "bank_name": string,        // Bank name (optional)
        "account_number": string    // Account number (optional)
      }
    ]
  }

  For Markdown format: Human-readable list of bank accounts with balances, types, and status.

Examples:
  - Use when: "Show me all bank accounts" → list all accounts with balances
  - Use when: "What's my bank balance?" → shows current balances for all accounts
  - Use when: "Which accounts are active?" → displays active/inactive status

Bank Account Information:
  - Each account includes the current balance in its native currency
  - Active accounts are marked with a checkmark, inactive with an X
  - Common account types include StandardBankAccount, SavingsAccount, CreditCardAccount
  - Bank name and account numbers are shown when available

Error Handling:
  - Returns authentication error if token lacks account access
  - Returns rate limit error (429) if exceeding API limits`,
    inputSchema: ListBankAccountsInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListBankAccountsInput) => {
    try {
      const result = await listBankAccounts(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_get_bank_account
 * Get detailed information about a specific bank account
 */
server.registerTool(
  "freeagent_get_bank_account",
  {
    title: "Get FreeAgent Bank Account Details",
    description: `Retrieve detailed information about a specific bank account by ID.

This tool fetches complete details for a single bank account, including banking details, current balance, and account configuration.

Args:
  - bank_account_id (string): The FreeAgent bank account ID (numeric) or full URL
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Complete bank account information including:
  - Account name and type
  - Current balance and currency
  - Active/inactive status
  - Banking details (bank name, account number, sort code)
  - International banking details (IBAN, BIC/SWIFT if available)
  - Opening balance
  - Created and updated timestamps

Examples:
  - Use when: "Get details for bank account 12345" → bank_account_id="12345"
  - Use when: "Show me the IBAN for my savings account" → first list accounts, then get specific one
  - Use when: "What's the sort code for account X?" → get detailed banking information

Bank Account Details:
  - Shows current balance reflecting all transactions
  - Includes UK banking details (sort code, account number) when available
  - Shows international details (IBAN, BIC/SWIFT) for international accounts
  - Active status indicates if account is currently in use

Error Handling:
  - Returns 404 error if bank account ID doesn't exist
  - Returns authentication error if token is expired or lacks access`,
    inputSchema: GetBankAccountInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetBankAccountInput) => {
    try {
      const result = await getBankAccount(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_list_bank_transactions
 * List bank transactions for a specific bank account
 */
server.registerTool(
  "freeagent_list_bank_transactions",
  {
    title: "List FreeAgent Bank Transactions",
    description: `List bank transactions for a specific bank account with pagination and filtering.

This tool retrieves bank transactions (both imported and manual) for a bank account. Transactions can be filtered by date range and explanation status. This is essential for bank reconciliation and tracking unexplained transactions.

Args:
  - bank_account (string): Bank account URL or ID to list transactions for (required)
  - page (number): Page number for pagination (default: 1)
  - per_page (number): Items per page, max 100 (default: 25)
  - from_date (string): Filter transactions from this date in YYYY-MM-DD format (optional)
  - to_date (string): Filter transactions to this date in YYYY-MM-DD format (optional)
  - view (string): Filter by explanation status - one of: all, unexplained (optional)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured list of transactions with pagination metadata:
  {
    "transactions": [
      {
        "url": string,                  // Transaction URL
        "dated_on": string,             // Transaction date (YYYY-MM-DD)
        "description": string,          // Transaction description
        "amount": string,               // Transaction amount (positive = credit, negative = debit)
        "unexplained_amount": string,   // Amount still needing explanation
        "is_manual": boolean,           // Whether manually entered or imported
        "bank_account": string          // Bank account URL
      }
    ],
    "pagination": {
      "page": number,
      "per_page": number,
      "total_count": number,
      "has_more": boolean,
      "next_page": number
    }
  }

  For Markdown format: Human-readable transaction list with dates, amounts, descriptions, and explanation status.

Examples:
  - Use when: "Show transactions for bank account 123" → bank_account="123"
  - Use when: "List unexplained transactions" → bank_account="123", view="unexplained"
  - Use when: "Show January transactions" → bank_account="123", from_date="2024-01-01", to_date="2024-01-31"
  - Use when: "Which transactions need explaining?" → use view="unexplained" to see only unreconciled items

Transaction Explanation Status:
  - Unexplained transactions are marked with ⚠️ and show unexplained amount
  - Explained transactions are marked with ✓ indicating full reconciliation
  - Unexplained transactions need explanations (categorization) for proper bookkeeping
  - Use view="unexplained" to quickly find transactions needing attention
  - Manual transactions are marked with [MANUAL] indicator

Bank Reconciliation Workflow:
  1. List transactions with view="unexplained" to find items needing attention
  2. Review each unexplained transaction's description and amount
  3. Use freeagent_create_bank_transaction_explanation to categorize them
  4. Link transactions to invoices, bills, or expense categories as appropriate

Error Handling:
  - Returns 404 if bank account doesn't exist
  - Returns rate limit error if too many requests
  - Suggests using date filters and view parameter to narrow results`,
    inputSchema: ListBankTransactionsInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListBankTransactionsInput) => {
    try {
      const result = await listBankTransactions(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_create_bank_transaction_explanation
 * Create a bank transaction explanation
 */
server.registerTool(
  "freeagent_create_bank_transaction_explanation",
  {
    title: "Explain FreeAgent Bank Transaction",
    description: `Create an explanation for a bank transaction by linking it to invoices, bills, or categories.

This tool "explains" (categorizes) bank transactions in FreeAgent by associating them with accounting entries. This is essential for reconciliation and accurate bookkeeping.

Args:
  - bank_transaction (string): Bank transaction URL or ID to explain (required)
  - dated_on (string): Transaction date in YYYY-MM-DD format (required)
  - gross_value (string): Transaction amount as decimal string (negative for debits) (required)
  - description (string): Description of the transaction (optional)
  - category (string): Category URL or ID for the transaction (optional)

  Link to entities (choose one or more):
  - paid_invoice (string): Invoice URL or ID that this transaction pays (optional)
  - paid_bill (string): Bill URL or ID that this transaction pays (optional)
  - paid_user (string): User URL or ID for money paid to/from user (optional)
  - transfer_bank_account (string): Destination bank account URL or ID for transfers (optional)
  - project (string): Project URL or ID to associate with transaction (optional)

  Tax information:
  - sales_tax_rate (string): Sales tax rate as decimal, e.g., '0.20' for 20% (optional)
  - sales_tax_value (string): Sales tax amount (optional)

  Attachment:
  - attachment (object): Optional supporting document:
    - data (string): Base64 encoded file content
    - file_name (string): Original filename
    - content_type (string): MIME type - application/pdf, image/png, image/jpeg, image/gif
    - description (string): Optional attachment description

Returns:
  Success message with explanation ID, date, amount, and type of explanation (invoice payment, bill payment, transfer, etc.).

Examples:
  - Use when: "Mark transaction as invoice payment" → paid_invoice="invoice_id"
  - Use when: "Explain transaction as bill payment" → paid_bill="bill_id"
  - Use when: "Categorize as transfer between accounts" → transfer_bank_account="target_account_id"
  - Use when: "Explain transaction with receipt" → include category and attachment

Tips:
  - Use the file-to-base64 skill to attach supporting documents
  - Explaining transactions is crucial for bank reconciliation
  - Link to invoices/bills for automatic matching
  - Use categories for general income/expenses

Error Handling:
  - Returns validation errors if required fields missing
  - Returns 404 if referenced entities don't exist
  - Suggests checking that bank transaction exists and is unexplained`,
    inputSchema: CreateBankTransactionExplanationInputSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async (params: CreateBankTransactionExplanationInput) => {
    try {
      const result = await createBankTransactionExplanation(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_get_company
 * Get company information
 */
server.registerTool(
  "freeagent_get_company",
  {
    title: "Get FreeAgent Company Information",
    description: `Retrieve information about your FreeAgent company account.

This tool fetches company details including name, registration, currency, tax status, and key accounting dates.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Company information including name, type, currency, registration number, tax status, and accounting dates.

Examples:
  - Use when: "What's my company currency?" → get company info
  - Use when: "When does my accounting year end?" → get company info

Error Handling:
  - Returns authentication error if token lacks company access`,
    inputSchema: GetCompanyInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetCompanyInput) => {
    try {
      const result = await getCompany(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Tool: freeagent_list_users
 * List all users in the account
 */
server.registerTool(
  "freeagent_list_users",
  {
    title: "List FreeAgent Users",
    description: `List all users in your FreeAgent account.

This tool retrieves all user accounts with their roles and permission levels.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  List of users with email, name, role, and permission level.

Examples:
  - Use when: "Who has access to FreeAgent?" → list users
  - Use when: "Show me all admin users" → list users then filter

Error Handling:
  - Requires appropriate permission level to view users`,
    inputSchema: ListUsersInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListUsersInput) => {
    try {
      const result = await listUsers(apiClient, params);
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: formatErrorForLLM(error as Error)
        }]
      };
    }
  }
);

/**
 * Main function to start the server
 */
async function main() {
  // Validate environment variables
  if (!ACCESS_TOKEN) {
    console.error(
      "ERROR: FREEAGENT_ACCESS_TOKEN environment variable is required.\n\n" +
      "To use this MCP server, you need to:\n" +
      "1. Create an app at https://dev.freeagent.com\n" +
      "2. Use OAuth 2.0 to obtain an access token\n" +
      "3. Set FREEAGENT_ACCESS_TOKEN environment variable\n" +
      "4. Optionally set FREEAGENT_USE_SANDBOX=true for sandbox API\n\n" +
      "For OAuth setup, see: https://dev.freeagent.com/docs/oauth"
    );
    process.exit(1);
  }

  // Initialize API client
  apiClient = new FreeAgentApiClient(ACCESS_TOKEN, USE_SANDBOX);

  // Create transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  const environment = USE_SANDBOX ? "sandbox" : "production";
  console.error(`FreeAgent MCP server running on stdio (${environment} API)`);
}

// Run the server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
