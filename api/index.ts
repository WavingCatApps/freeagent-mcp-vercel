/**
 * FreeAgent MCP Server with Full OAuth Proxy
 *
 * This server acts as a complete OAuth Authorization Server that proxies to FreeAgent:
 * 1. Claude connects and discovers OAuth endpoints
 * 2. Users are redirected to FreeAgent for login
 * 3. FreeAgent redirects back with auth code
 * 4. We exchange for FreeAgent tokens and issue MCP tokens
 * 5. MCP tokens are mapped to FreeAgent tokens for API calls
 */

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createFreeAgentJWTOAuthProvider, getFreeAgentTokenFromJWT } from "../src/services/oauth-jwt.js";
import { FreeAgentApiClient, formatErrorForLLM } from "../src/services/api-client.js";
import { listContacts, getContact, createContact } from "../src/tools/contacts.js";
import { listInvoices, getInvoice, createInvoice } from "../src/tools/invoices.js";
import { listExpenses, getExpense, createExpense } from "../src/tools/expenses.js";
import { listTimeslips, getTimeslip, createTimeslip } from "../src/tools/timeslips.js";
import { listBankAccounts, getBankAccount, listBankTransactions } from "../src/tools/bank-accounts.js";
import { createBankTransactionExplanation } from "../src/tools/bank-transactions.js";
import { getCompany, listUsers } from "../src/tools/company.js";
import { listProjects, getProject, createProject } from "../src/tools/projects.js";
import { listTasks, getTask, createTask } from "../src/tools/tasks.js";
import { listCategories, getCategory } from "../src/tools/categories.js";
import {
  ListContactsInputSchema, GetContactInputSchema, CreateContactInputSchema,
  ListInvoicesInputSchema, GetInvoiceInputSchema, CreateInvoiceInputSchema,
  ListExpensesInputSchema, GetExpenseInputSchema, CreateExpenseInputSchema,
  ListTimeslipsInputSchema, GetTimeslipInputSchema, CreateTimeslipInputSchema,
  ListBankAccountsInputSchema, GetBankAccountInputSchema, ListBankTransactionsInputSchema,
  CreateBankTransactionExplanationInputSchema, GetCompanyInputSchema, ListUsersInputSchema,
  ListProjectsInputSchema, GetProjectInputSchema, CreateProjectInputSchema,
  ListTasksInputSchema, GetTaskInputSchema, CreateTaskInputSchema,
  ListCategoriesInputSchema, GetCategoryInputSchema,
  type ListContactsInput, type GetContactInput, type CreateContactInput,
  type ListInvoicesInput, type GetInvoiceInput, type CreateInvoiceInput,
  type ListExpensesInput, type GetExpenseInput, type CreateExpenseInput,
  type ListTimeslipsInput, type GetTimeslipInput, type CreateTimeslipInput,
  type ListBankAccountsInput, type GetBankAccountInput, type ListBankTransactionsInput,
  type CreateBankTransactionExplanationInput, type GetCompanyInput, type ListUsersInput,
  type ListProjectsInput, type GetProjectInput, type CreateProjectInput,
  type ListTasksInput, type GetTaskInput, type CreateTaskInput,
  type ListCategoriesInput, type GetCategoryInput
} from "../src/schemas/index.js";

// Configuration
const USE_SANDBOX = process.env.FREEAGENT_USE_SANDBOX === "true";

// Determine base URL
// IMPORTANT: Set PRODUCTION_URL in Vercel environment variables to use a stable URL
// Example: PRODUCTION_URL=freeagent-mcp-vercel-simonrices-projects.vercel.app
// This ensures OAuth callbacks use a consistent URL instead of per-deployment URLs
const PRODUCTION_URL = process.env.PRODUCTION_URL;
const VERCEL_BRANCH_URL = process.env.VERCEL_BRANCH_URL;
const VERCEL_URL = process.env.VERCEL_URL;

const BASE_URL = PRODUCTION_URL
  ? `https://${PRODUCTION_URL}`
  : (VERCEL_BRANCH_URL
    ? `https://${VERCEL_BRANCH_URL}`
    : (VERCEL_URL ? `https://${VERCEL_URL}` : (process.env.BASE_URL || "http://localhost:3000")));

// Create Express app
const app = express();

// Enable trust proxy for Vercel (required for rate limiting and X-Forwarded-For headers)
// Use number of proxies instead of 'true' to satisfy express-rate-limit security requirements
// Vercel is 1 proxy hop away, so we trust the first proxy
app.set('trust proxy', 1);

app.use(express.json());

// Create JWT-based OAuth provider (stateless)
const oauthProvider = createFreeAgentJWTOAuthProvider();

// Add error logging for OAuth token endpoint
app.use((req: any, res: any, next: any) => {
  if (req.path === '/token') {
    const originalJson = res.json.bind(res);

    // Only log errors, not successful requests
    res.json = function(body: any) {
      if (body.error) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          component: "oauth-token-error",
          message: "Token endpoint error",
          data: {
            grantType: req.body?.grant_type,
            error: body.error,
            errorDescription: body.error_description,
          }
        }));
      }
      return originalJson(body);
    };
  }
  next();
});

// Install full OAuth router (provides /authorize, /token, /register, etc.)
app.use(mcpAuthRouter({
  provider: oauthProvider,
  issuerUrl: new URL(BASE_URL),
  baseUrl: new URL(BASE_URL),
  serviceDocumentationUrl: new URL("https://dev.freeagent.com/docs/oauth"),
  scopesSupported: ["freeagent"],
  resourceName: "FreeAgent MCP Server",
  resourceServerUrl: new URL(BASE_URL),
}));

// OAuth callback handler (receives redirect from FreeAgent)
app.get("/oauth/callback", async (req: any, res: any) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send(`FreeAgent authorization failed: ${error}`);
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.status(400).send("Invalid callback parameters");
    }

    // Handle the FreeAgent callback
    const result = await oauthProvider.handleFreeAgentCallback(state, code);

    // Redirect back to Claude with our authorization code
    const redirectUrl = new URL(result.redirectUri);
    redirectUrl.searchParams.set("code", result.code);
    if (result.state) {
      redirectUrl.searchParams.set("state", result.state);
    }

    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send(`Callback error: ${error}`);
  }
});

// Create MCP server with tools
function createMcpServer(freeagentToken: string): McpServer {
  const server = new McpServer({
    name: "freeagent-mcp-server",
    version: "1.0.0"
  });

  const apiClient = new FreeAgentApiClient(freeagentToken, USE_SANDBOX);

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

  registerTool("freeagent_list_projects", {
    title: "List FreeAgent Projects",
    description: "List all projects in your FreeAgent account with filtering and pagination.",
    inputSchema: ListProjectsInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listProjects);

  registerTool("freeagent_get_project", {
    title: "Get FreeAgent Project Details",
    description: "Retrieve detailed information about a specific project by ID.",
    inputSchema: GetProjectInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getProject);

  registerTool("freeagent_create_project", {
    title: "Create FreeAgent Project",
    description: "Create a new project in FreeAgent.",
    inputSchema: CreateProjectInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, createProject);

  registerTool("freeagent_list_tasks", {
    title: "List FreeAgent Tasks",
    description: "List tasks in your FreeAgent account with filtering and pagination.",
    inputSchema: ListTasksInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listTasks);

  registerTool("freeagent_get_task", {
    title: "Get FreeAgent Task Details",
    description: "Retrieve detailed information about a specific task by ID.",
    inputSchema: GetTaskInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getTask);

  registerTool("freeagent_create_task", {
    title: "Create FreeAgent Task",
    description: "Create a new task within a project in FreeAgent.",
    inputSchema: CreateTaskInputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, createTask);

  registerTool("freeagent_list_categories", {
    title: "List FreeAgent Categories",
    description: "List all categories in your FreeAgent account for expenses, invoices, and transactions.",
    inputSchema: ListCategoriesInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, listCategories);

  registerTool("freeagent_get_category", {
    title: "Get FreeAgent Category Details",
    description: "Retrieve detailed information about a specific category by nominal code.",
    inputSchema: GetCategoryInputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  }, getCategory);

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

// MCP endpoint - PROTECTED with bearer token (handles both GET and POST)
app.all(
  "/mcp",
  requireBearerAuth({
    verifier: oauthProvider,
    resourceMetadataUrl: `${BASE_URL}/.well-known/oauth-protected-resource`
  }),
  async (req: any, res: any) => {
    try {
      const mcpToken = req.headers.authorization?.replace("Bearer ", "");
      if (!mcpToken) {
        console.error("/mcp: No authorization token provided");
        return res.status(401).json({ error: "No authorization token" });
      }

      const freeagentToken = getFreeAgentTokenFromJWT(mcpToken);
      if (!freeagentToken) {
        console.error("/mcp: Invalid or expired JWT token");
        return res.status(401).json({ error: "Invalid token" });
      }

      const server = createMcpServer(freeagentToken);
      // Use StreamableHTTPServerTransport in stateless mode (perfect for serverless!)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP endpoint error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

// Root endpoint - MCP with bearer auth (handles both GET and POST)
app.all(
  "/",
  requireBearerAuth({
    verifier: oauthProvider,
    resourceMetadataUrl: `${BASE_URL}/.well-known/oauth-protected-resource`
  }),
  async (req: any, res: any) => {
    try {
      const mcpToken = req.headers.authorization?.replace("Bearer ", "");
      if (!mcpToken) {
        return res.status(401).json({ error: "No authorization token" });
      }

      const freeagentToken = getFreeAgentTokenFromJWT(mcpToken);
      if (!freeagentToken) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const server = createMcpServer(freeagentToken);
      // Use StreamableHTTPServerTransport in stateless mode (perfect for serverless!)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Root MCP endpoint error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
);

// Health check
app.get("/health", (req: any, res: any) => {
  res.json({
    status: "ok",
    service: "freeagent-mcp-server",
    version: "1.0.0",
    oauth_mode: "jwt-stateless",
    freeagent_environment: USE_SANDBOX ? "sandbox" : "production",
  });
});

export default app;
