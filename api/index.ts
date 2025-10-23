/**
 * FreeAgent MCP Server with OAuth (Simplified)
 *
 * This server acts as a Resource Server that:
 * - Accepts FreeAgent OAuth tokens directly (no token mapping)
 * - Validates tokens by calling FreeAgent's API
 * - Uses the same token for FreeAgent API calls
 * - Provides OAuth metadata for Claude to discover FreeAgent's auth endpoints
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { createFreeAgentTokenVerifier } from "../src/services/freeagent-auth.js";
import { FreeAgentApiClient, formatErrorForLLM } from "../src/services/api-client.js";
import { listContacts, getContact, createContact } from "../src/tools/contacts.js";
import { listInvoices, getInvoice, createInvoice } from "../src/tools/invoices.js";
import { listExpenses, getExpense, createExpense } from "../src/tools/expenses.js";
import { listTimeslips, getTimeslip, createTimeslip } from "../src/tools/timeslips.js";
import { listBankAccounts, getBankAccount, listBankTransactions } from "../src/tools/bank-accounts.js";
import { createBankTransactionExplanation } from "../src/tools/bank-transactions.js";
import { getCompany, listUsers } from "../src/tools/company.js";
import {
  ListContactsInputSchema, GetContactInputSchema, CreateContactInputSchema,
  ListInvoicesInputSchema, GetInvoiceInputSchema, CreateInvoiceInputSchema,
  ListExpensesInputSchema, GetExpenseInputSchema, CreateExpenseInputSchema,
  ListTimeslipsInputSchema, GetTimeslipInputSchema, CreateTimeslipInputSchema,
  ListBankAccountsInputSchema, GetBankAccountInputSchema, ListBankTransactionsInputSchema,
  CreateBankTransactionExplanationInputSchema, GetCompanyInputSchema, ListUsersInputSchema,
  type ListContactsInput, type GetContactInput, type CreateContactInput,
  type ListInvoicesInput, type GetInvoiceInput, type CreateInvoiceInput,
  type ListExpensesInput, type GetExpenseInput, type CreateExpenseInput,
  type ListTimeslipsInput, type GetTimeslipInput, type CreateTimeslipInput,
  type ListBankAccountsInput, type GetBankAccountInput, type ListBankTransactionsInput,
  type CreateBankTransactionExplanationInput, type GetCompanyInput, type ListUsersInput
} from "../src/schemas/index.js";

// Configuration
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";
const FREEAGENT_CLIENT_ID = process.env.FREEAGENT_CLIENT_ID;
const VERCEL_URL = process.env.VERCEL_URL;
const BASE_URL = VERCEL_URL ? `https://${VERCEL_URL}` : (process.env.BASE_URL || "http://localhost:3000");

const FREEAGENT_BASE_URL = USE_SANDBOX
  ? "https://api.sandbox.freeagent.com"
  : "https://api.freeagent.com";

// Create Express app
const app = express();
app.use(express.json());

// Create FreeAgent token verifier
const tokenVerifier = createFreeAgentTokenVerifier();

// Install OAuth metadata router
// This provides /.well-known/oauth-protected-resource endpoint
// Claude will use this to discover where to send users for authorization
app.use(mcpAuthMetadataRouter({
  oauthMetadata: {
    issuer: FREEAGENT_BASE_URL,
    authorization_endpoint: `${FREEAGENT_BASE_URL}/v2/approve_app`,
    token_endpoint: `${FREEAGENT_BASE_URL}/v2/token_endpoint`,
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    response_types_supported: ["code"],
    scopes_supported: ["freeagent"],
    code_challenge_methods_supported: ["S256"],
  },
  resourceServerUrl: new URL(BASE_URL),
  serviceDocumentationUrl: new URL("https://dev.freeagent.com/docs/oauth"),
  scopesSupported: ["freeagent"],
  resourceName: "FreeAgent MCP Server"
}));

// Create MCP server with tools
function createMcpServer(freeagentToken: string): McpServer {
  const server = new McpServer({
    name: "freeagent-mcp-server",
    version: "1.0.0"
  });

  // Initialize API client with the FreeAgent token
  const apiClient = new FreeAgentApiClient(freeagentToken, USE_SANDBOX);

  // Helper function for tool registration
  const registerTool = (
    name: string,
    config: any,
    handler: (apiClient: FreeAgentApiClient, params: any) => Promise<string>
  ) => {
    server.registerTool(name, config, async (params: any) => {
      try {
        const result = await handler(apiClient, params);
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: formatErrorForLLM(error as Error) }] };
      }
    });
  };

  // Register all tools
  registerTool("freeagent_list_contacts", {
    title: "List FreeAgent Contacts",
    description: "List all contacts in your FreeAgent account with pagination support.",
    inputSchema: ListContactsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listContacts);

  registerTool("freeagent_get_contact", {
    title: "Get FreeAgent Contact Details",
    description: "Retrieve detailed information about a specific contact by ID.",
    inputSchema: GetContactInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getContact);

  registerTool("freeagent_create_contact", {
    title: "Create FreeAgent Contact",
    description: "Create a new contact in FreeAgent.",
    inputSchema: CreateContactInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, createContact);

  registerTool("freeagent_list_invoices", {
    title: "List FreeAgent Invoices",
    description: "List invoices in your FreeAgent account with filtering and pagination.",
    inputSchema: ListInvoicesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listInvoices);

  registerTool("freeagent_get_invoice", {
    title: "Get FreeAgent Invoice Details",
    description: "Retrieve detailed information about a specific invoice.",
    inputSchema: GetInvoiceInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getInvoice);

  registerTool("freeagent_create_invoice", {
    title: "Create FreeAgent Invoice",
    description: "Create a new invoice in FreeAgent.",
    inputSchema: CreateInvoiceInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, createInvoice);

  registerTool("freeagent_list_expenses", {
    title: "List FreeAgent Expenses",
    description: "List expenses in your FreeAgent account with filtering and pagination.",
    inputSchema: ListExpensesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listExpenses);

  registerTool("freeagent_get_expense", {
    title: "Get FreeAgent Expense Details",
    description: "Retrieve detailed information about a specific expense by ID.",
    inputSchema: GetExpenseInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getExpense);

  registerTool("freeagent_create_expense", {
    title: "Create FreeAgent Expense",
    description: "Create a new expense in FreeAgent, including regular expenses or mileage claims.",
    inputSchema: CreateExpenseInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, createExpense);

  registerTool("freeagent_list_timeslips", {
    title: "List FreeAgent Timeslips",
    description: "List timeslips in your FreeAgent account with filtering and pagination.",
    inputSchema: ListTimeslipsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listTimeslips);

  registerTool("freeagent_get_timeslip", {
    title: "Get FreeAgent Timeslip Details",
    description: "Retrieve detailed information about a specific timeslip by ID.",
    inputSchema: GetTimeslipInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getTimeslip);

  registerTool("freeagent_create_timeslip", {
    title: "Create FreeAgent Timeslip",
    description: "Create a new timeslip (time tracking entry) in FreeAgent.",
    inputSchema: CreateTimeslipInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, createTimeslip);

  registerTool("freeagent_list_bank_accounts", {
    title: "List FreeAgent Bank Accounts",
    description: "List all bank accounts in your FreeAgent account.",
    inputSchema: ListBankAccountsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listBankAccounts);

  registerTool("freeagent_get_bank_account", {
    title: "Get FreeAgent Bank Account Details",
    description: "Retrieve detailed information about a specific bank account by ID.",
    inputSchema: GetBankAccountInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getBankAccount);

  registerTool("freeagent_list_bank_transactions", {
    title: "List FreeAgent Bank Transactions",
    description: "List bank transactions for a specific bank account with pagination and filtering.",
    inputSchema: ListBankTransactionsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listBankTransactions);

  registerTool("freeagent_create_bank_transaction_explanation", {
    title: "Explain FreeAgent Bank Transaction",
    description: "Create an explanation for a bank transaction by linking it to invoices, bills, or categories.",
    inputSchema: CreateBankTransactionExplanationInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, createBankTransactionExplanation);

  registerTool("freeagent_get_company", {
    title: "Get FreeAgent Company Information",
    description: "Retrieve information about your FreeAgent company account.",
    inputSchema: GetCompanyInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getCompany);

  registerTool("freeagent_list_users", {
    title: "List FreeAgent Users",
    description: "List all users in your FreeAgent account.",
    inputSchema: ListUsersInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listUsers);

  return server;
}

// MCP SSE endpoint - PROTECTED with FreeAgent bearer token
app.get(
  "/",
  requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: ["freeagent"],
    resourceMetadataUrl: `${BASE_URL}/.well-known/oauth-protected-resource`
  }),
  async (req, res) => {
    try {
      // Extract the FreeAgent token from the Authorization header
      const freeagentToken = req.headers.authorization?.replace("Bearer ", "");

      if (!freeagentToken) {
        return res.status(401).json({ error: "No authorization token provided" });
      }

      // Create MCP server with the FreeAgent token
      const server = createMcpServer(freeagentToken);

      // Create SSE transport
      const transport = new SSEServerTransport("/message", res);

      // Connect the server
      await server.connect(transport);

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
    } catch (error) {
      console.error("Error in MCP endpoint:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// MCP message endpoint - PROTECTED with FreeAgent bearer token
app.post(
  "/message",
  requireBearerAuth({
    verifier: tokenVerifier,
    requiredScopes: ["freeagent"],
    resourceMetadataUrl: `${BASE_URL}/.well-known/oauth-protected-resource`
  }),
  async (req, res) => {
    try {
      // Extract the FreeAgent token
      const freeagentToken = req.headers.authorization?.replace("Bearer ", "");

      if (!freeagentToken) {
        return res.status(401).json({ error: "No authorization token provided" });
      }

      // Create MCP server with the FreeAgent token
      const server = createMcpServer(freeagentToken);

      // Create SSE transport and handle the message
      const transport = new SSEServerTransport("/message", res);
      await transport.handlePostMessage(req.body, res);
    } catch (error) {
      console.error("Error in MCP message endpoint:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Health check endpoint (unprotected)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "freeagent-mcp-server",
    version: "1.0.0",
    oauth_enabled: true,
    freeagent_environment: USE_SANDBOX ? "sandbox" : "production",
    client_id_configured: !!FREEAGENT_CLIENT_ID,
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
export default app;
