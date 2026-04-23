/**
 * Shared tool registration for FreeAgent MCP Server
 *
 * Defines all tool configurations and registers them on an McpServer instance.
 * Used by both api/index.ts (Vercel/HTTP) and src/index.ts (stdio).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ElicitRequestFormParams, ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { FreeAgentApiClient, formatErrorForLLM } from "../services/api-client.js";
import { listContacts, getContact, createContact } from "./contacts.js";
import { listInvoices, getInvoice, createInvoice } from "./invoices.js";
import { invoiceFromTimeslips } from "./invoice-from-timeslips.js";
import { transitionInvoice } from "./transition-invoice.js";
import { listExpenses, getExpense, createExpense, updateExpense } from "./expenses.js";
import { logExpense } from "./log-expense.js";
import { listBills, getBill, createBill } from "./bills.js";
import { listTimeslips, getTimeslip, createTimeslip, updateTimeslip } from "./timeslips.js";
import { listBankAccounts, getBankAccount, listBankTransactions, getBankTransaction } from "./bank-accounts.js";
import { listBankTransactionExplanations, getBankTransactionExplanation, createBankTransactionExplanation, updateBankTransactionExplanation } from "./bank-transactions.js";
import { reconcileBankTransaction } from "./reconcile.js";
import { listProjects, getProject, createProject } from "./projects.js";
import { listTasks, getTask, createTask } from "./tasks.js";
import { listCategories, getCategory } from "./categories.js";
import { getCompany, listUsers } from "./company.js";
import {
  ListContactsInputSchema, GetContactInputSchema, CreateContactInputSchema,
  ListInvoicesInputSchema, GetInvoiceInputSchema, CreateInvoiceInputSchema, InvoiceFromTimeslipsInputSchema, TransitionInvoiceInputSchema,
  ListExpensesInputSchema, GetExpenseInputSchema, CreateExpenseInputSchema, UpdateExpenseInputSchema, LogExpenseInputSchema,
  ListBillsInputSchema, GetBillInputSchema, CreateBillInputSchema,
  ListTimeslipsInputSchema, GetTimeslipInputSchema, CreateTimeslipInputSchema, UpdateTimeslipInputSchema,
  ListBankAccountsInputSchema, GetBankAccountInputSchema, ListBankTransactionsInputSchema, GetBankTransactionInputSchema,
  ListBankTransactionExplanationsInputSchema, GetBankTransactionExplanationInputSchema,
  CreateBankTransactionExplanationInputSchema, UpdateBankTransactionExplanationInputSchema,
  ReconcileBankTransactionInputSchema,
  ListProjectsInputSchema, GetProjectInputSchema, CreateProjectInputSchema,
  ListTasksInputSchema, GetTaskInputSchema, CreateTaskInputSchema,
  ListCategoriesInputSchema, GetCategoryInputSchema,
  GetCompanyInputSchema, ListUsersInputSchema,
} from "../schemas/index.js";

export interface ToolContext {
  clientSupportsElicitation: boolean;
  elicit: (params: ElicitRequestFormParams) => Promise<ElicitResult>;
}

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: any;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  handler: (apiClient: FreeAgentApiClient, params: any, ctx: ToolContext) => Promise<string>;
}

/**
 * All tool definitions for the FreeAgent MCP server.
 * Single source of truth used by both Vercel and stdio entry points.
 */
export const toolDefinitions: ToolDefinition[] = [
  // Contact Management
  {
    name: "freeagent_list_contacts",
    title: "List FreeAgent Contacts",
    description: "List all contacts in your FreeAgent account with pagination support.",
    inputSchema: ListContactsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listContacts,
  },
  {
    name: "freeagent_get_contact",
    title: "Get FreeAgent Contact Details",
    description: "Retrieve detailed information about a specific contact by ID.",
    inputSchema: GetContactInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getContact,
  },
  {
    name: "freeagent_create_contact",
    title: "Create FreeAgent Contact",
    description: "Create a new contact in FreeAgent.",
    inputSchema: CreateContactInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createContact,
  },

  // Invoice Management
  {
    name: "freeagent_list_invoices",
    title: "List FreeAgent Invoices",
    description: "List invoices in your FreeAgent account with filtering and pagination.",
    inputSchema: ListInvoicesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listInvoices,
  },
  {
    name: "freeagent_get_invoice",
    title: "Get FreeAgent Invoice Details",
    description: "Retrieve detailed information about a specific invoice.",
    inputSchema: GetInvoiceInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getInvoice,
  },
  {
    name: "freeagent_create_invoice",
    title: "Create FreeAgent Invoice",
    description: "Create a new invoice in FreeAgent.",
    inputSchema: CreateInvoiceInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createInvoice,
  },
  {
    name: "freeagent_transition_invoice",
    title: "Transition FreeAgent Invoice",
    description:
      "Move a FreeAgent invoice between lifecycle states: mark as sent, cancelled, draft, scheduled, or convert to a credit note. Use after freeagent_invoice_from_timeslips or freeagent_create_invoice to take a draft through to sent.",
    inputSchema: TransitionInvoiceInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: transitionInvoice,
  },
  {
    name: "freeagent_invoice_from_timeslips",
    title: "Draft FreeAgent Invoice From Timeslips",
    description:
      "Draft an invoice from a contact's unbilled timeslips in one call. Resolves the contact by name/ID/URL, finds active projects, collects unbilled timeslips in the given date range (defaults: first day of previous month → today), groups by task using the task or project billing rate, and posts a draft invoice. Note: the timeslips themselves are not auto-linked to the invoice.",
    inputSchema: InvoiceFromTimeslipsInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: invoiceFromTimeslips,
  },

  // Expense Management
  {
    name: "freeagent_list_expenses",
    title: "List FreeAgent Expenses",
    description: "List expenses in your FreeAgent account with filtering and pagination.",
    inputSchema: ListExpensesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listExpenses,
  },
  {
    name: "freeagent_get_expense",
    title: "Get FreeAgent Expense Details",
    description: "Retrieve detailed information about a specific expense by ID.",
    inputSchema: GetExpenseInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getExpense,
  },
  {
    name: "freeagent_create_expense",
    title: "Create FreeAgent Expense",
    description: "Create a new expense in FreeAgent, including regular expenses or mileage claims.",
    inputSchema: CreateExpenseInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createExpense,
  },
  {
    name: "freeagent_update_expense",
    title: "Update FreeAgent Expense",
    description: "Update an existing expense in FreeAgent. Only provide the fields you want to change.",
    inputSchema: UpdateExpenseInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: updateExpense,
  },
  // Bill Management
  {
    name: "freeagent_list_bills",
    title: "List FreeAgent Bills",
    description: "List supplier bills with filtering and pagination.",
    inputSchema: ListBillsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listBills,
  },
  {
    name: "freeagent_get_bill",
    title: "Get FreeAgent Bill Details",
    description: "Retrieve detailed information about a specific supplier bill by ID.",
    inputSchema: GetBillInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getBill,
  },
  {
    name: "freeagent_create_bill",
    title: "Create FreeAgent Bill",
    description: "Create a new supplier bill in FreeAgent. Used to record money owed to suppliers.",
    inputSchema: CreateBillInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createBill,
  },

  {
    name: "freeagent_log_expense",
    title: "Log FreeAgent Expense",
    description:
      "Log a regular expense in one call. Takes a POSITIVE amount plus `kind` ('expense' or 'refund') — the tool applies the correct sign, so you never send a negative value. Accepts a category name, nominal code, or URL; accepts a user email, ID, or URL (defaults to the sole user on the account). Use freeagent_create_expense for mileage, recurring expenses, or receipt attachments.",
    inputSchema: LogExpenseInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: logExpense,
  },

  // Timeslip Management
  {
    name: "freeagent_list_timeslips",
    title: "List FreeAgent Timeslips",
    description: "List timeslips in your FreeAgent account with filtering and pagination.",
    inputSchema: ListTimeslipsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listTimeslips,
  },
  {
    name: "freeagent_get_timeslip",
    title: "Get FreeAgent Timeslip Details",
    description: "Retrieve detailed information about a specific timeslip by ID.",
    inputSchema: GetTimeslipInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getTimeslip,
  },
  {
    name: "freeagent_create_timeslip",
    title: "Create FreeAgent Timeslip",
    description: "Create a new timeslip (time tracking entry) in FreeAgent.",
    inputSchema: CreateTimeslipInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createTimeslip,
  },
  {
    name: "freeagent_update_timeslip",
    title: "Update FreeAgent Timeslip",
    description: "Update an existing timeslip. Supports setting `billed_on_invoice` to link the timeslip to an invoice, though FreeAgent may reject external writes to that field.",
    inputSchema: UpdateTimeslipInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: updateTimeslip,
  },

  // Bank Account Management
  {
    name: "freeagent_list_bank_accounts",
    title: "List FreeAgent Bank Accounts",
    description: "List all bank accounts in your FreeAgent account.",
    inputSchema: ListBankAccountsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listBankAccounts,
  },
  {
    name: "freeagent_get_bank_account",
    title: "Get FreeAgent Bank Account Details",
    description: "Retrieve detailed information about a specific bank account by ID.",
    inputSchema: GetBankAccountInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getBankAccount,
  },
  {
    name: "freeagent_list_bank_transactions",
    title: "List FreeAgent Bank Transactions",
    description: "List bank transactions for a specific bank account with pagination and filtering.",
    inputSchema: ListBankTransactionsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listBankTransactions,
  },
  {
    name: "freeagent_get_bank_transaction",
    title: "Get FreeAgent Bank Transaction",
    description: "Get detailed information about a specific bank transaction including amount, description, and explanation status.",
    inputSchema: GetBankTransactionInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getBankTransaction,
  },

  // Bank Transaction Explanations
  {
    name: "freeagent_list_bank_transaction_explanations",
    title: "List FreeAgent Bank Transaction Explanations",
    description: "List bank transaction explanations showing how transactions were categorized or linked to invoices, bills, or transfers.",
    inputSchema: ListBankTransactionExplanationsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listBankTransactionExplanations,
  },
  {
    name: "freeagent_get_bank_transaction_explanation",
    title: "Get FreeAgent Bank Transaction Explanation",
    description: "Get detailed information about a specific bank transaction explanation including categorization, tax info, and linked entities.",
    inputSchema: GetBankTransactionExplanationInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getBankTransactionExplanation,
  },
  {
    name: "freeagent_create_bank_transaction_explanation",
    title: "Explain FreeAgent Bank Transaction",
    description: "Create an explanation for a bank transaction by linking it to invoices, bills, or categories.",
    inputSchema: CreateBankTransactionExplanationInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createBankTransactionExplanation,
  },
  {
    name: "freeagent_update_bank_transaction_explanation",
    title: "Update FreeAgent Bank Transaction Explanation",
    description: "Update an existing bank transaction explanation. Only provide the fields you want to change.",
    inputSchema: UpdateBankTransactionExplanationInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: updateBankTransactionExplanation,
  },
  {
    name: "freeagent_reconcile_bank_transaction",
    title: "Reconcile FreeAgent Bank Transaction",
    description:
      "Explain a bank transaction in one call. Accepts a human-friendly hint (category name like 'Travel', nominal code like '285', or invoice reference like 'INV-001') and resolves it to the correct FreeAgent URL server-side. Auto-fills date and amount from the transaction, so you do not need to call get_bank_transaction or list_categories first. Provide exactly one of `category` or `paid_invoice`.",
    inputSchema: ReconcileBankTransactionInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: reconcileBankTransaction,
  },

  // Project Management
  {
    name: "freeagent_list_projects",
    title: "List FreeAgent Projects",
    description: "List all projects in your FreeAgent account with filtering and pagination.",
    inputSchema: ListProjectsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listProjects,
  },
  {
    name: "freeagent_get_project",
    title: "Get FreeAgent Project Details",
    description: "Retrieve detailed information about a specific project by ID.",
    inputSchema: GetProjectInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getProject,
  },
  {
    name: "freeagent_create_project",
    title: "Create FreeAgent Project",
    description: "Create a new project in FreeAgent.",
    inputSchema: CreateProjectInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createProject,
  },

  // Task Management
  {
    name: "freeagent_list_tasks",
    title: "List FreeAgent Tasks",
    description: "List tasks in your FreeAgent account with filtering and pagination.",
    inputSchema: ListTasksInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listTasks,
  },
  {
    name: "freeagent_get_task",
    title: "Get FreeAgent Task Details",
    description: "Retrieve detailed information about a specific task by ID.",
    inputSchema: GetTaskInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getTask,
  },
  {
    name: "freeagent_create_task",
    title: "Create FreeAgent Task",
    description: "Create a new task within a project in FreeAgent.",
    inputSchema: CreateTaskInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    handler: createTask,
  },

  // Category Management
  {
    name: "freeagent_list_categories",
    title: "List FreeAgent Categories",
    description: "List all categories in your FreeAgent account for expenses, invoices, and transactions.",
    inputSchema: ListCategoriesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listCategories,
  },
  {
    name: "freeagent_get_category",
    title: "Get FreeAgent Category Details",
    description: "Retrieve detailed information about a specific category by nominal code.",
    inputSchema: GetCategoryInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getCategory,
  },

  // Company & Users
  {
    name: "freeagent_get_company",
    title: "Get FreeAgent Company Information",
    description: "Retrieve information about your FreeAgent company account.",
    inputSchema: GetCompanyInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: getCompany,
  },
  {
    name: "freeagent_list_users",
    title: "List FreeAgent Users",
    description: "List all users in your FreeAgent account.",
    inputSchema: ListUsersInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: listUsers,
  },
];

/**
 * Register all FreeAgent tools on an McpServer instance.
 *
 * @param server - The McpServer to register tools on
 * @param apiClient - The FreeAgent API client to use for API calls
 */
export function registerAllTools(server: McpServer, apiClient: FreeAgentApiClient): void {
  const ctx: ToolContext = {
    get clientSupportsElicitation(): boolean {
      return Boolean(server.server.getClientCapabilities()?.elicitation);
    },
    elicit: (params) => server.server.elicitInput(params),
  };

  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (params: any) => {
        try {
          const result = await tool.handler(apiClient, params, ctx);
          return { content: [{ type: "text" as const, text: result }] };
        } catch (error) {
          return { isError: true, content: [{ type: "text" as const, text: formatErrorForLLM(error as Error) }] };
        }
      }
    );
  }
}
