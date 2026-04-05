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
import { listExpenses, getExpense, createExpense, updateExpense } from "./tools/expenses.js";
import { listTimeslips, getTimeslip, createTimeslip } from "./tools/timeslips.js";
import { listBankAccounts, getBankAccount, listBankTransactions, getBankTransaction } from "./tools/bank-accounts.js";
import { listBankTransactionExplanations, getBankTransactionExplanation, createBankTransactionExplanation, updateBankTransactionExplanation } from "./tools/bank-transactions.js";
import { listCategories, getCategory } from "./tools/categories.js";
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
  UpdateExpenseInputSchema,
  ListTimeslipsInputSchema,
  GetTimeslipInputSchema,
  CreateTimeslipInputSchema,
  ListBankAccountsInputSchema,
  GetBankAccountInputSchema,
  ListBankTransactionsInputSchema,
  GetBankTransactionInputSchema,
  ListBankTransactionExplanationsInputSchema,
  GetBankTransactionExplanationInputSchema,
  CreateBankTransactionExplanationInputSchema,
  UpdateBankTransactionExplanationInputSchema,
  ListCategoriesInputSchema,
  GetCategoryInputSchema,
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
  type UpdateExpenseInput,
  type ListTimeslipsInput,
  type GetTimeslipInput,
  type CreateTimeslipInput,
  type ListBankAccountsInput,
  type GetBankAccountInput,
  type ListBankTransactionsInput,
  type GetBankTransactionInput,
  type ListBankTransactionExplanationsInput,
  type GetBankTransactionExplanationInput,
  type CreateBankTransactionExplanationInput,
  type UpdateBankTransactionExplanationInput,
  type ListCategoriesInput,
  type GetCategoryInput,
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

server.registerTool(
  "freeagent_list_contacts",
  {
    title: "List FreeAgent Contacts",
    description: `List all contacts (customers, suppliers, and other business contacts) in your FreeAgent account with pagination and sorting support.

Examples:
  - "Show me all my contacts" → use with default pagination
  - "Find contacts sorted by name" → use sort="first_name"
  - "Show me page 2 of contacts" → use page=2

Note: Rate limited to 15 requests per 60 seconds. Results paginated.`,
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

server.registerTool(
  "freeagent_get_contact",
  {
    title: "Get FreeAgent Contact Details",
    description: `Retrieve detailed information about a specific contact including name, email, phone, address, payment terms, and metadata.

Examples:
  - "Get details for contact 12345" → contact_id="12345"
  - "Show me contact information for John Doe" → first list contacts, then get specific one

Note: Returns 404 if contact ID doesn't exist.`,
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

server.registerTool(
  "freeagent_create_contact",
  {
    title: "Create FreeAgent Contact",
    description: `Create a new customer, supplier, or business contact in FreeAgent. Provide either organisation_name or both first_name and last_name.

Examples:
  - "Create a contact for ABC Ltd" → organisation_name="ABC Ltd", email="..."
  - "Add John Smith as a customer" → first_name="John", last_name="Smith"

Note: Returns validation errors (422) if neither organisation_name nor first_name/last_name provided.`,
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

server.registerTool(
  "freeagent_list_invoices",
  {
    title: "List FreeAgent Invoices",
    description: `List invoices in your FreeAgent account with filtering by status, contact, project, and date ranges.

Examples:
  - "Show me all overdue invoices" → view="overdue"
  - "List invoices for contact 123" → contact="123"
  - "Show draft invoices sorted by date" → view="draft", sort="dated_on"

Note: Rate limited. Use view parameter to filter large result sets. Results paginated.`,
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

server.registerTool(
  "freeagent_get_invoice",
  {
    title: "Get FreeAgent Invoice Details",
    description: `Retrieve detailed information about a specific invoice including line items, amounts, status, dates, and contact.

Examples:
  - "Get invoice 12345 details" → invoice_id="12345"
  - "Show me the line items for invoice INV-001" → first find invoice, then get details

Note: Returns 404 if invoice doesn't exist.`,
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

server.registerTool(
  "freeagent_create_invoice",
  {
    title: "Create FreeAgent Invoice",
    description: `Create a new invoice in Draft status. Requires a contact and at least one line item.

Examples:
  - "Create invoice for contact 123" → contact="123", dated_on="2024-01-15", invoice_items=[...]
  - "Invoice ABC Ltd for consulting" → use contact with organisation_name, add line items

Note: Invoice is created in Draft status. Returns 404 if contact doesn't exist.`,
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

server.registerTool(
  "freeagent_list_expenses",
  {
    title: "List FreeAgent Expenses",
    description: `List business expenses and mileage claims with filtering by date range and status.

Examples:
  - "Show me all expenses for January 2024" → from_date="2024-01-01", to_date="2024-01-31"
  - "List expenses awaiting receipts" → view="awaiting_receipt"
  - "Show my mileage expenses" → list all and filter by miles field

Note: Rate limited. Use date filters to narrow large result sets. Results paginated.`,
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

server.registerTool(
  "freeagent_get_expense",
  {
    title: "Get FreeAgent Expense Details",
    description: `Retrieve detailed information about a specific expense including amount, category, attachments, and mileage details if applicable.

Examples:
  - "Get expense 12345 details" → expense_id="12345"
  - "Show me the receipt for expense XYZ" → first get expense, check attachment_count

Note: Returns 404 if expense doesn't exist.`,
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

server.registerTool(
  "freeagent_create_expense",
  {
    title: "Create FreeAgent Expense",
    description: `Create a new expense in FreeAgent, including regular expenses or mileage claims. Use NEGATIVE gross_value for normal expenses (e.g., "-10.00" for £10 spent); positive values represent refunds. For mileage, provide miles instead of gross_value.

Examples:
  - "Create expense for hotel £150" → gross_value="-150.00", category="Accommodation"
  - "Log 50 miles by car" → miles="50", mileage_vehicle_type="Car"
  - "Record a £50 refund received" → gross_value="50.00"

Note: Rate limited. Returns 422 if required fields missing, 404 if user/category doesn't exist. For attachments >50KB, use gzip compression before Base64 encoding (set is_gzipped=true).`,
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

server.registerTool(
  "freeagent_update_expense",
  {
    title: "Update FreeAgent Expense",
    description: `Update an existing expense in FreeAgent. Only provide the fields you want to change. Use NEGATIVE gross_value for normal expenses (e.g., "-200.00" for £200 spent).

Examples:
  - "Update expense description to 'Client dinner'" → expense_id="123", description="Client dinner"
  - "Change expense category" → expense_id="123", category="[category_url]"
  - "Update expense amount to £200" → expense_id="123", gross_value="-200.00"

Note: Returns 404 if expense doesn't exist, 422 if invalid data. Use freeagent_list_categories to find category URLs.`,
    inputSchema: UpdateExpenseInputSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: UpdateExpenseInput) => {
    try {
      const result = await updateExpense(apiClient, params);
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

server.registerTool(
  "freeagent_list_timeslips",
  {
    title: "List FreeAgent Timeslips",
    description: `List time tracking entries (timeslips) with filtering by date range, user, project, and billing status.

Examples:
  - "Show me all unbilled timeslips" → view="unbilled"
  - "List my hours for project 123 in January" → project="123", from_date="2024-01-01", to_date="2024-01-31"
  - "Show timeslips for user 456" → user="456"

Note: Rate limited. Results paginated. Use filters to narrow large result sets.`,
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

server.registerTool(
  "freeagent_get_timeslip",
  {
    title: "Get FreeAgent Timeslip Details",
    description: `Retrieve detailed information about a specific timeslip including hours, task, project, user, and billing status.

Examples:
  - "Get timeslip 12345 details" → timeslip_id="12345"
  - "Check if timeslip has been billed" → get timeslip, check billed_on_invoice field

Note: Returns 404 if timeslip doesn't exist.`,
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

server.registerTool(
  "freeagent_create_timeslip",
  {
    title: "Create FreeAgent Timeslip",
    description: `Create a new timeslip (time tracking entry) in FreeAgent for a project task. Hours can be decimal (e.g., 7.5 for 7h30m).

Examples:
  - "Log 8 hours on project 123 task 456" → hours="8", project="123", task="456"
  - "Track 3.5 hours of work" → hours="3.5"
  - "Record time worked today" → dated_on=today's date, hours="..."

Note: Returns 422 if required fields missing, 404 if project/task/user doesn't exist.`,
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

server.registerTool(
  "freeagent_list_bank_accounts",
  {
    title: "List FreeAgent Bank Accounts",
    description: `List all bank accounts including current accounts, savings, and credit cards with balances and status.

Examples:
  - "Show me all bank accounts" → list all accounts with balances
  - "What's my bank balance?" → shows current balances for all accounts
  - "Which accounts are active?" → displays active/inactive status

Note: Rate limited. Each account shows current balance, currency, type, and active/inactive status.`,
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

server.registerTool(
  "freeagent_get_bank_account",
  {
    title: "Get FreeAgent Bank Account Details",
    description: `Retrieve detailed information about a specific bank account including balance, banking details (sort code, account number, IBAN), and status.

Examples:
  - "Get details for bank account 12345" → bank_account_id="12345"
  - "Show me the IBAN for my savings account" → first list accounts, then get specific one
  - "What's the sort code for account X?" → get detailed banking information

Note: Returns 404 if bank account doesn't exist.`,
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

server.registerTool(
  "freeagent_list_bank_transactions",
  {
    title: "List FreeAgent Bank Transactions",
    description: `List bank transactions for a specific account with filtering by date range and explanation status. Essential for bank reconciliation.

Examples:
  - "Show transactions for bank account 123" → bank_account="123"
  - "List unexplained transactions" → bank_account="123", view="unexplained"
  - "Show January transactions" → bank_account="123", from_date="2024-01-01", to_date="2024-01-31"
  - "Which transactions need explaining?" → view="unexplained"

Note: Rate limited. Results paginated. Use view="unexplained" to find transactions needing categorization via freeagent_create_bank_transaction_explanation.`,
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

server.registerTool(
  "freeagent_get_bank_transaction",
  {
    title: "Get FreeAgent Bank Transaction",
    description: `Get detailed information about a specific bank transaction including amount, description, and explanation status.

Examples:
  - "Show details for transaction 12345" → bank_transaction_id="12345"
  - "What's the description of this transaction?" → fetch transaction details
  - "Does this transaction need explaining?" → check unexplained_amount field

Note: Returns 404 if transaction doesn't exist.`,
    inputSchema: GetBankTransactionInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetBankTransactionInput) => {
    try {
      const result = await getBankTransaction(apiClient, params);
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

server.registerTool(
  "freeagent_list_bank_transaction_explanations",
  {
    title: "List FreeAgent Bank Transaction Explanations",
    description: `List bank transaction explanations showing how transactions were categorized or linked to invoices, bills, or transfers.

Examples:
  - "Show all bank transaction explanations" → list all
  - "List explanations for account 123" → bank_account="123"
  - "Show explanations from January" → from_date="2024-01-01", to_date="2024-01-31"
  - "Which transactions need review?" → check marked_for_review field

Note: Rate limited. Results paginated. Use date filters and bank_account to narrow results.`,
    inputSchema: ListBankTransactionExplanationsInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListBankTransactionExplanationsInput) => {
    try {
      const result = await listBankTransactionExplanations(apiClient, params);
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

server.registerTool(
  "freeagent_get_bank_transaction_explanation",
  {
    title: "Get FreeAgent Bank Transaction Explanation",
    description: `Get detailed information about a specific bank transaction explanation including categorization, tax info, and linked entities (invoices, bills, transfers).

Examples:
  - "Show details for explanation 456" → bank_transaction_explanation_id="456"
  - "What's the category for this explanation?" → get full details
  - "Check if explanation needs review" → check marked_for_review field

Note: Returns 404 if explanation doesn't exist.`,
    inputSchema: GetBankTransactionExplanationInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetBankTransactionExplanationInput) => {
    try {
      const result = await getBankTransactionExplanation(apiClient, params);
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

server.registerTool(
  "freeagent_create_bank_transaction_explanation",
  {
    title: "Explain FreeAgent Bank Transaction",
    description: `Explain (categorize) a bank transaction by linking it to invoices, bills, categories, or transfers. Essential for bank reconciliation.

Examples:
  - "Mark transaction as invoice payment" → paid_invoice="invoice_id"
  - "Explain transaction as bill payment" → paid_bill="bill_id"
  - "Categorize as transfer between accounts" → transfer_bank_account="target_account_id"
  - "Explain transaction with receipt" → include category and attachment

Note: Returns 422 if required fields missing, 404 if referenced entities don't exist. For attachments >50KB, use gzip compression before Base64 encoding (set is_gzipped=true).`,
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

server.registerTool(
  "freeagent_update_bank_transaction_explanation",
  {
    title: "Update FreeAgent Bank Transaction Explanation",
    description: `Update an existing bank transaction explanation. Only provide the fields you want to change.

Examples:
  - "Update transaction explanation description" → bank_transaction_explanation_id="123", description="New description"
  - "Change transaction category" → bank_transaction_explanation_id="123", category="[category_url]"
  - "Update explanation category and description" → provide both fields in one call

Note: Returns 404 if explanation doesn't exist, 422 if invalid data. Use freeagent_list_categories to find category URLs.`,
    inputSchema: UpdateBankTransactionExplanationInputSchema.shape,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: UpdateBankTransactionExplanationInput) => {
    try {
      const result = await updateBankTransactionExplanation(apiClient, params);
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

server.registerTool(
  "freeagent_get_company",
  {
    title: "Get FreeAgent Company Information",
    description: `Retrieve company details including name, registration, currency, tax status, and key accounting dates.

Examples:
  - "What's my company currency?" → get company info
  - "When does my accounting year end?" → get company info

Note: Returns authentication error if token lacks company access.`,
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

server.registerTool(
  "freeagent_list_users",
  {
    title: "List FreeAgent Users",
    description: `List all users in your FreeAgent account with their roles and permission levels.

Examples:
  - "Who has access to FreeAgent?" → list users
  - "Show me all admin users" → list users then filter

Note: Requires appropriate permission level to view users.`,
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

server.registerTool(
  "freeagent_list_categories",
  {
    title: "List FreeAgent Categories",
    description: `List all expense and income categories organized by type: Admin Expenses, Cost of Sales, Income, and General. Use nominal_code or URL from results when creating expenses or explaining transactions.

Examples:
  - "What expense categories are available?" → list all categories
  - "Show me custom categories" → view="custom"
  - "Find category for office expenses" → list categories and search
  - "Which categories are tax deductible?" → check allowable_for_tax field

Note: Rate limited. Use view parameter to filter by "all", "standard", or "custom".`,
    inputSchema: ListCategoriesInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: ListCategoriesInput) => {
    try {
      const result = await listCategories(apiClient, params);
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

server.registerTool(
  "freeagent_get_category",
  {
    title: "Get FreeAgent Category",
    description: `Get detailed information about a specific expense or income category including tax treatment, nominal code, and default VAT rate.

Examples:
  - "Show me details for category 001" → nominal_code="001"
  - "What's the tax rate for Travel category?" → check auto_sales_tax_rate
  - "Is this category tax deductible?" → check allowable_for_tax

Note: Accepts nominal_code or full URL. Returns 404 if category doesn't exist.`,
    inputSchema: GetCategoryInputSchema.shape,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetCategoryInput) => {
    try {
      const result = await getCategory(apiClient, params);
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

// Logging helper with timestamps
function log(level: string, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  };
  console.error(JSON.stringify(logEntry));
}

async function main() {
  // Validate environment variables
  if (!ACCESS_TOKEN) {
    log("error", "FREEAGENT_ACCESS_TOKEN environment variable is required", {
      instructions: [
        "Create an app at https://dev.freeagent.com",
        "Use OAuth 2.0 to obtain an access token",
        "Set FREEAGENT_ACCESS_TOKEN environment variable",
        "Optionally set FREEAGENT_USE_SANDBOX=true for sandbox API",
      ],
      documentation: "https://dev.freeagent.com/docs/oauth",
    });
    process.exit(1);
  }

  log("info", "Starting FreeAgent MCP server", {
    environment: USE_SANDBOX ? "sandbox" : "production",
    nodeVersion: process.version,
    platform: process.platform,
  });

  // Initialize API client
  apiClient = new FreeAgentApiClient(ACCESS_TOKEN, USE_SANDBOX);

  // Create transport
  const transport = new StdioServerTransport();

  // Add error handler for transport
  process.stdin.on("error", (error) => {
    log("error", "stdin error - connection may be lost", {
      error: error.message,
      stack: error.stack,
    });
  });

  process.stdout.on("error", (error) => {
    log("error", "stdout error - connection may be lost", {
      error: error.message,
      stack: error.stack,
    });
  });

  process.stdin.on("end", () => {
    log("warn", "stdin ended - client disconnected");
  });

  process.stdin.on("close", () => {
    log("warn", "stdin closed - connection terminated");
  });

  // Monitor for unhandled errors
  process.on("uncaughtException", (error) => {
    log("error", "Uncaught exception", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, _promise) => {
    log("error", "Unhandled promise rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    log("info", "Received shutdown signal", { signal });
    try {
      // Give time for in-flight requests to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      log("info", "Server shutdown complete");
      process.exit(0);
    } catch (error) {
      log("error", "Error during shutdown", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Connect server to transport
  try {
    await server.connect(transport);
    const environment = USE_SANDBOX ? "sandbox" : "production";
    log("info", "FreeAgent MCP server connected successfully", {
      environment,
      transport: "stdio",
    });

    // Log heartbeat every 30 seconds to detect if process is alive
    const heartbeatInterval = setInterval(() => {
      log("debug", "Server heartbeat", {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });
    }, 30000);

    // Clean up heartbeat on exit
    process.on("exit", () => {
      clearInterval(heartbeatInterval);
    });

    // Warning: Log token expiration concern (tokens typically expire after 1 hour)
    log("warn", "Note: FreeAgent access tokens typically expire after 1 hour. If you experience disconnects, check token expiration.", {
      tokenLength: ACCESS_TOKEN.length,
      suggestion: "Consider implementing OAuth refresh tokens for long-running connections",
    });
  } catch (error) {
    log("error", "Failed to connect server to transport", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the server
main().catch((error) => {
  log("error", "Fatal server error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
