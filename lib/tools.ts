import { z } from 'zod';
import { createClient, makeDirectRequest, enhanceTimeslipData } from './utils.js';

// Attachment reference for expenses and bank transaction explanations
// Note: Claude cannot upload files - only reference existing attachments
// Attachments must be uploaded to FreeAgent via web or mobile app first
const AttachmentSchema = z.string().describe('URL of an existing attachment in FreeAgent. Attachments must be uploaded to FreeAgent via web or mobile app first, then referenced by their URL.');

export const registerTools = (server: any) => {
  // Tool introspection and documentation tools
  server.tool(
    'describe_tools',
    'Get detailed specifications and parameter information for all available FreeAgent MCP tools',
    {
      tool_name: z.string().optional().describe('Optional: Get details for a specific tool name'),
      category: z.enum(['timeslips', 'projects', 'expenses', 'bills', 'bank_accounts', 'bank_transactions', 'bank_transaction_explanations', 'categories', 'users', 'introspection']).optional().describe('Optional: Filter tools by category'),
    },
    async (params: any) => {
      const toolSpecs = {
        // Timeslip tools
        list_timeslips: {
          category: 'timeslips',
          description: 'List and filter timeslips from FreeAgent',
          parameters: {
            from_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'Start date filter' },
            to_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'End date filter' },
            view: { type: 'enum', optional: true, values: ['all', 'unbilled', 'running'], description: 'Filter view' },
            user: { type: 'string', optional: true, description: 'User URL to filter by' },
            project: { type: 'string', optional: true, description: 'Project URL to filter by' },
            task: { type: 'string', optional: true, description: 'Task URL to filter by' }
          }
        },
        get_timeslip: {
          category: 'timeslips',
          description: 'Get a specific timeslip by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Timeslip ID' }
          }
        },
        create_timeslip: {
          category: 'timeslips',
          description: 'Create a new timeslip in FreeAgent',
          parameters: {
            task: { type: 'string', required: true, description: 'Task URL' },
            user: { type: 'string', required: true, description: 'User URL' },
            project: { type: 'string', required: true, description: 'Project URL' },
            dated_on: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Date' },
            hours: { type: 'number', required: true, description: 'Number of hours' },
            comment: { type: 'string', optional: true, description: 'Optional comment' }
          }
        },
        update_timeslip: {
          category: 'timeslips',
          description: 'Update an existing timeslip',
          parameters: {
            id: { type: 'string', required: true, description: 'Timeslip ID' },
            task: { type: 'string', optional: true, description: 'Task URL' },
            user: { type: 'string', optional: true, description: 'User URL' },
            project: { type: 'string', optional: true, description: 'Project URL' },
            dated_on: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'Date' },
            hours: { type: 'number', optional: true, description: 'Number of hours' },
            comment: { type: 'string', optional: true, description: 'Comment' }
          }
        },
        delete_timeslip: {
          category: 'timeslips',
          description: 'Delete a timeslip',
          parameters: {
            id: { type: 'string', required: true, description: 'Timeslip ID' }
          }
        },
        start_timer: {
          category: 'timeslips',
          description: 'Start a timer for a timeslip',
          parameters: {
            id: { type: 'string', required: true, description: 'Timeslip ID' }
          }
        },
        stop_timer: {
          category: 'timeslips',
          description: 'Stop a timer for a timeslip',
          parameters: {
            id: { type: 'string', required: true, description: 'Timeslip ID' }
          }
        },

        // Project tools
        list_projects: {
          category: 'projects',
          description: 'List all projects in FreeAgent',
          parameters: {
            view: { type: 'enum', optional: true, values: ['all', 'active', 'completed'], default: 'active', description: 'Filter view' }
          }
        },
        create_task: {
          category: 'projects',
          description: 'Create a new task for a project',
          parameters: {
            project: { type: 'string', required: true, description: 'Project URL or ID' },
            name: { type: 'string', required: true, description: 'Task name' },
            is_recurring: { type: 'boolean', optional: true, default: false, description: 'Whether this is a recurring task' },
            status: { type: 'enum', optional: true, values: ['Active', 'Hidden', 'Completed'], default: 'Active', description: 'Task status' }
          }
        },

        // Bill tools
        list_bills: {
          category: 'bills',
          description: 'List bills from FreeAgent',
          parameters: {
            view: { type: 'enum', optional: true, values: ['all', 'open', 'overdue', 'paid', 'recurring'], description: 'Filter view' },
            from_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'Start date' },
            to_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'End date' },
            updated_since: { type: 'string', optional: true, format: 'ISO timestamp', description: 'Get bills updated since' },
            contact: { type: 'string', optional: true, description: 'Contact URL to filter by' },
            project: { type: 'string', optional: true, description: 'Project URL to filter by' }
          }
        },
        get_bill: {
          category: 'bills',
          description: 'Get a specific bill by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Bill ID' }
          }
        },
        create_bill: {
          category: 'bills',
          description: 'Create a new bill in FreeAgent with full support for line items, attachments, and project rebilling',
          parameters: {
            contact: { type: 'string', required: true, description: 'Contact URL who is being billed' },
            reference: { type: 'string', required: true, description: 'Bill reference number' },
            dated_on: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Bill date' },
            due_on: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Bill due date' },
            bill_items: { type: 'array', required: true, description: 'Array of bill line items (max 40 items)' },
            currency: { type: 'string', optional: true, description: 'Currency code (e.g., GBP, USD)' },
            project: { type: 'string', optional: true, description: 'Project URL to associate with' },
            ec_status: { type: 'enum', optional: true, values: ['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS'], description: 'VAT status for reporting purposes' },
            file: { type: 'string', optional: true, description: 'URL of existing attachment in FreeAgent' },
            recurring: { type: 'enum', optional: true, values: ['Weekly', 'Every 2 Weeks', 'Every 4 Weeks', 'Monthly', 'Every 2 Months', 'Quarterly', 'Every 6 Months', 'Annually'], description: 'Recurring frequency' },
            rebill_type: { type: 'enum', optional: true, values: ['marked_up', 'marked_down', 'at_cost'], description: 'Rebill type for project billing' },
            rebill_factor: { type: 'number', optional: true, description: 'Rebill percentage (0-100)' }
          }
        },
        update_bill: {
          category: 'bills',
          description: 'Update an existing bill',
          parameters: {
            id: { type: 'string', required: true, description: 'Bill ID' }
            // All other parameters same as create_bill but optional
          }
        },
        delete_bill: {
          category: 'bills',
          description: 'Delete a bill',
          parameters: {
            id: { type: 'string', required: true, description: 'Bill ID' }
          }
        },

        // Expense tools
        list_expenses: {
          category: 'expenses',
          description: 'List expenses from FreeAgent',
          parameters: {
            view: { type: 'enum', optional: true, values: ['recent', 'recurring'], description: 'Filter view' },
            from_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'Start date' },
            to_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'End date' },
            updated_since: { type: 'string', optional: true, format: 'ISO timestamp', description: 'Get expenses updated since' },
            user: { type: 'string', optional: true, description: 'User URL to filter by' },
            project: { type: 'string', optional: true, description: 'Project URL to filter by' }
          }
        },
        get_expense: {
          category: 'expenses',
          description: 'Get a specific expense by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Expense ID' }
          }
        },
        create_expense: {
          category: 'expenses',
          description: 'Create a new expense in FreeAgent with support for referencing existing attachments. Includes full support for mileage claims and rebilling.',
          parameters: {
            user: { type: 'string', required: true, description: 'User URL (expense claimant)' },
            category: { type: 'string', required: true, description: 'Category URL for the expense' },
            dated_on: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Expense date' },
            ec_status: { type: 'enum', required: true, values: ['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS'], description: 'VAT status for reporting purposes' },
            description: { type: 'string', optional: true, description: 'Description of the expense' },
            gross_value: { type: 'number', optional: true, description: 'Gross expense amount' },
            sales_tax_rate: { type: 'number', optional: true, description: 'Sales tax rate as percentage' },
            sales_tax_value: { type: 'number', optional: true, description: 'Manual sales tax amount' },
            project: { type: 'string', optional: true, description: 'Project URL to associate with' },
            file: { type: 'string', optional: true, description: 'URL of existing attachment in FreeAgent. Attachments must be uploaded to FreeAgent via web or mobile app first.' },
            currency: { type: 'string', optional: true, description: 'Currency code (e.g., GBP, USD)' },
            mileage: { type: 'number', optional: true, description: 'Mileage for travel expenses' },
            vehicle_type: { type: 'enum', optional: true, values: ['Car', 'Motorcycle', 'Bicycle'], description: 'Vehicle type for mileage claims' },
            engine_type: { type: 'enum', optional: true, values: ['Petrol', 'Diesel', 'LPG', 'Electric', 'Electric_Hybrid'], description: 'Engine type for mileage claims' },
            engine_size: { type: 'number', optional: true, description: 'Engine size for mileage claims' },
            reclaim_mileage: { type: 'number', optional: true, min: 0, max: 1, description: 'Reclaim mileage (0=default, 1=at AMAP rate)' },
            is_rebillable: { type: 'boolean', optional: true, description: 'Whether expense can be rebilled to client' },
            rebill_factor: { type: 'number', optional: true, min: 0, max: 100, description: 'Rebill percentage (0-100)' },
            rebill_type: { type: 'enum', optional: true, values: ['marked_up', 'marked_down', 'at_cost'], description: 'Rebill type' },
            receipt_reference: { type: 'string', optional: true, description: 'Receipt reference number or identifier' }
          }
        },
        update_expense: {
          category: 'expenses',
          description: 'Update an existing expense',
          parameters: {
            id: { type: 'string', required: true, description: 'Expense ID' },
            // All other parameters same as create_expense but optional
          }
        },
        delete_expense: {
          category: 'expenses',
          description: 'Delete an expense',
          parameters: {
            id: { type: 'string', required: true, description: 'Expense ID' }
          }
        },

        // Bank account tools
        list_bank_accounts: {
          category: 'bank_accounts',
          description: 'List bank accounts from FreeAgent',
          parameters: {
            view: { type: 'enum', optional: true, values: ['standard_bank_accounts', 'credit_card_accounts', 'paypal_accounts'], description: 'Filter by account type' }
          }
        },
        get_bank_account: {
          category: 'bank_accounts',
          description: 'Get a specific bank account by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Bank account ID' }
          }
        },

        // Bank transaction tools
        list_bank_transactions: {
          category: 'bank_transactions',
          description: 'List bank transactions for a specific bank account',
          parameters: {
            bank_account: { type: 'string', required: true, description: 'Bank account URL or ID' },
            from_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'Start date' },
            to_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'End date' },
            view: { type: 'enum', optional: true, values: ['all', 'unexplained', 'explained', 'manual', 'imported', 'marked_for_review'], default: 'all', description: 'Filter view' },
            updated_since: { type: 'string', optional: true, format: 'ISO timestamp', description: 'Get transactions updated since' },
            last_uploaded: { type: 'boolean', optional: true, description: 'Get only transactions from most recent statement upload' }
          }
        },
        get_bank_transaction: {
          category: 'bank_transactions',
          description: 'Get a specific bank transaction by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Bank transaction ID' }
          }
        },

        // Bank transaction explanation tools
        list_bank_transaction_explanations: {
          category: 'bank_transaction_explanations',
          description: 'List bank transaction explanations',
          parameters: {
            from_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'Start date' },
            to_date: { type: 'string', optional: true, format: 'YYYY-MM-DD', description: 'End date' },
            updated_since: { type: 'string', optional: true, format: 'ISO timestamp', description: 'Get explanations updated since' }
          }
        },
        get_bank_transaction_explanation: {
          category: 'bank_transaction_explanations',
          description: 'Get a specific bank transaction explanation by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Bank transaction explanation ID' }
          }
        },
        create_bank_transaction_explanation: {
          category: 'bank_transaction_explanations',
          description: 'Create an explanation for a bank transaction with IMAGE ATTACHMENT support. Upload supporting images (receipts, invoices) in PNG, JPEG, GIF, or PDF format. Includes full tax handling.',
          parameters: {
            bank_transaction: { type: 'string', optional: true, description: 'Bank transaction URL to explain' },
            bank_account: { type: 'string', optional: true, description: 'Bank account URL (alternative to bank_transaction)' },
            dated_on: { type: 'string', required: true, format: 'YYYY-MM-DD', description: 'Transaction date' },
            gross_value: { type: 'number', required: true, description: 'Transaction amount (negative for expenses, positive for income)' },
            category: { type: 'string', required: true, description: 'Category URL for the transaction' },
            description: { type: 'string', optional: true, description: 'Description of the transaction' },
            sales_tax_status: { type: 'enum', optional: true, values: ['TAXABLE', 'EXEMPT', 'OUT_OF_SCOPE'], description: 'Sales tax status' },
            ec_status: { type: 'enum', optional: true, values: ['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS'], description: 'VAT status for reporting purposes' },
            sales_tax_rate: { type: 'number', optional: true, description: 'Sales tax rate as percentage' },
            sales_tax_value: { type: 'number', optional: true, description: 'Manual sales tax amount' },
            project: { type: 'string', optional: true, description: 'Project URL to associate with' },
            file: { type: 'string', optional: true, description: 'URL of existing attachment in FreeAgent. Attachments must be uploaded to FreeAgent via web or mobile app first.' },
            paid_user: { type: 'string', optional: true, description: 'User URL for expense payments (Money Paid to User transactions)' },
            receipt_reference: { type: 'string', optional: true, description: 'Receipt reference number or identifier' },
            marked_for_review: { type: 'boolean', optional: true, description: 'Whether explanation is marked for review (true=needs approval, false=approved)' }
          }
        },
        update_bank_transaction_explanation: {
          category: 'bank_transaction_explanations',
          description: 'Update an existing bank transaction explanation',
          parameters: {
            id: { type: 'string', required: true, description: 'Bank transaction explanation ID' },
            // All other parameters same as create but optional
          }
        },
        delete_bank_transaction_explanation: {
          category: 'bank_transaction_explanations',
          description: 'Delete a bank transaction explanation',
          parameters: {
            id: { type: 'string', required: true, description: 'Bank transaction explanation ID' }
          }
        },

        // Category tools
        list_categories: {
          category: 'categories',
          description: 'List all categories from FreeAgent',
          parameters: {
            sub_accounts: { type: 'boolean', optional: true, description: 'Include sub-accounts in the response' }
          }
        },
        get_category: {
          category: 'categories',
          description: 'Get a specific category by nominal code',
          parameters: {
            nominal_code: { type: 'string', required: true, description: 'Category nominal code' }
          }
        },
        create_category: {
          category: 'categories',
          description: 'Create a new category',
          parameters: {
            description: { type: 'string', required: true, description: 'Category name/description' },
            nominal_code: { type: 'string', required: true, description: 'Category nominal code' },
            category_type: { type: 'enum', required: true, values: ['income', 'cost_of_sales', 'admin_expenses', 'current_assets', 'liabilities', 'equity'], description: 'Category type' },
            allowable_for_tax: { type: 'boolean', optional: true, description: 'Whether category is tax deductible' },
            tax_reporting_name: { type: 'string', optional: true, description: 'Name for statutory accounts reporting' }
          }
        },
        update_category: {
          category: 'categories',
          description: 'Update an existing category',
          parameters: {
            nominal_code: { type: 'string', required: true, description: 'Category nominal code' },
            description: { type: 'string', optional: true, description: 'Category name/description' },
            allowable_for_tax: { type: 'boolean', optional: true, description: 'Whether category is tax deductible' },
            tax_reporting_name: { type: 'string', optional: true, description: 'Name for statutory accounts reporting' }
          }
        },
        delete_category: {
          category: 'categories',
          description: 'Delete a category (only user-created categories without existing items)',
          parameters: {
            nominal_code: { type: 'string', required: true, description: 'Category nominal code' }
          }
        },

        // User tools
        list_users: {
          category: 'users',
          description: 'List users from FreeAgent',
          parameters: {
            view: { type: 'enum', optional: true, values: ['all', 'staff', 'active_staff', 'advisors', 'active_advisors'], description: 'Filter users by type' }
          }
        },
        get_user: {
          category: 'users',
          description: 'Get details of a specific user by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'User ID (use "me" for current authenticated user)' }
          }
        },
        get_current_user: {
          category: 'users',
          description: 'Get the current authenticated user profile',
          parameters: {}
        },
        create_user: {
          category: 'users',
          description: 'Create a new user in FreeAgent',
          parameters: {
            first_name: { type: 'string', required: true, description: 'User first name' },
            last_name: { type: 'string', required: true, description: 'User last name' },
            email: { type: 'string', required: true, description: 'User email address' },
            role: { type: 'enum', required: true, values: ['Owner', 'Director', 'Employee', 'Shareholder', 'Advisor'], description: 'User role' },
            permission_level: { type: 'number', required: true, min: 0, max: 8, description: 'Permission level (0-8, higher = more access)' },
            ni_number: { type: 'string', optional: true, description: 'National Insurance Number' },
            unique_tax_reference: { type: 'string', optional: true, description: 'Unique Tax Reference' },
            send_invitation: { type: 'boolean', optional: true, default: true, description: 'Send invitation email' }
          }
        },
        update_user: {
          category: 'users',
          description: 'Update an existing user',
          parameters: {
            id: { type: 'string', required: true, description: 'User ID (use "me" for current user)' },
            // Other parameters same as create but optional
          }
        },
        delete_user: {
          category: 'users',
          description: 'Delete a user from FreeAgent',
          parameters: {
            id: { type: 'string', required: true, description: 'User ID to delete' }
          }
        },

        // Attachment tools
        get_attachment: {
          category: 'attachments',
          description: 'Get details of a specific attachment by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Attachment ID' }
          }
        },
        delete_attachment: {
          category: 'attachments',
          description: 'Delete a specific attachment by ID',
          parameters: {
            id: { type: 'string', required: true, description: 'Attachment ID' }
          }
        },

        // Introspection tools
        describe_tools: {
          category: 'introspection',
          description: 'Get detailed specifications for all available tools',
          parameters: {
            tool_name: { type: 'string', optional: true, description: 'Get details for a specific tool' },
            category: { type: 'enum', optional: true, values: ['timeslips', 'projects', 'expenses', 'bills', 'bank_accounts', 'bank_transactions', 'bank_transaction_explanations', 'categories', 'users', 'introspection'], description: 'Filter tools by category' }
          }
        },
        get_api_docs: {
          category: 'introspection',
          description: 'Get FreeAgent API documentation and examples',
          parameters: {
            topic: { type: 'enum', optional: true, values: ['overview', 'authentication', 'expenses', 'bank_transactions', 'attachments', 'mileage_claims', 'tax_handling'], description: 'Specific documentation topic' }
          }
        },
        validate_parameters: {
          category: 'introspection',
          description: 'Test parameter formats before making actual API calls',
          parameters: {
            tool_name: { type: 'string', required: true, description: 'Tool name to validate parameters for' },
            parameters: { type: 'object', required: true, description: 'Parameters to validate' }
          }
        },

        // Attachment management tools - Note: FreeAgent API does not provide list attachments endpoint
      };

      let result: any = toolSpecs;

      if (params.tool_name) {
        result = (toolSpecs as any)[params.tool_name] ? { [params.tool_name]: (toolSpecs as any)[params.tool_name] } : { error: `Tool '${params.tool_name}' not found` };
      } else if (params.category) {
        result = Object.fromEntries(
          Object.entries(toolSpecs).filter(([_, spec]: [string, any]) => spec.category === params.category)
        );
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  server.tool(
    'get_api_docs',
    'Get FreeAgent API documentation and usage examples',
    {
      topic: z.enum(['overview', 'authentication', 'expenses', 'bills', 'bank_transactions', 'attachments', 'image_processing', 'mileage_claims', 'tax_handling']).optional().describe('Specific documentation topic'),
    },
    async (params: any) => {
      const docs = {
        overview: {
          title: 'FreeAgent MCP Server Overview',
          description: 'This MCP server provides comprehensive access to FreeAgent accounting functionality',
          core_features: [
            'Complete timeslip management with timer support',
            'Expense tracking with mileage claims and existing attachment references',
            'Bank account and transaction management',
            'Transaction explanations with existing attachment support',
            'Project and task management',
            'User management with role-based permissions',
            'Category management for accounting',
            'Attachment management (existing files only - upload via FreeAgent web/mobile first)'
          ],
          attachment_workflow: [
            'Attachments must be uploaded via FreeAgent web/mobile first',
            'Reference attachment URLs in expenses and transaction explanations',
            'View attachment details with get_attachment',
            'Delete unnecessary attachments with delete_attachment'
          ],
          authentication: 'Uses OAuth 2.0 with Bearer token authentication',
          base_url: 'https://api.freeagent.com/v2'
        },
        
        smart_capture_approval: {
          title: 'Smart Capture Approval Workflow',
          description: 'Approve pre-populated transaction explanations created by FreeAgent Smart Capture',
          workflow: [
            '1. List transactions marked for review: list_bank_transaction_explanations({ view: "marked_for_review" })',
            '2. Review the pre-populated explanation details',
            '3. Approve by updating: update_bank_transaction_explanation({ id: "...", marked_for_review: false })',
            '4. Or modify and approve: update_bank_transaction_explanation({ id: "...", description: "updated", marked_for_review: false })'
          ],
          key_features: [
            'Smart Capture automatically categorizes receipts and creates explanations',
            'Explanations are marked with marked_for_review: true',
            'Use marked_for_review: false to approve the explanation',
            'Can modify explanation details before approval',
            'Bulk approval possible by iterating through marked_for_review transactions'
          ],
          benefits: [
            'Streamlines approval of automatically categorized transactions',
            'Reduces manual data entry for receipt processing',
            'Enables programmatic approval workflows',
            'Maintains audit trail of approved vs pending transactions'
          ]
        },
        
        authentication: {
          title: 'Authentication',
          method: 'OAuth 2.0 Bearer Token',
          format: 'Base64 encoded JSON with: {clientId, clientSecret, accessToken, refreshToken}',
          example: 'Bearer eyJjbGllbnRJZCI6IjEyMyIsImNsaWVudFNlY3JldCI6IjQ1NiIsImFjY2Vzc1Rva2VuIjoiN...'
        },
        
        expenses: {
          title: 'Expense Management',
          description: 'Create and manage business expenses with full tax and attachment support',
          key_features: [
            'Multiple expense types (standard, mileage, rebillable)',
            'VAT/Tax handling (TAXABLE, EXEMPT, OUT_OF_SCOPE)',
            'Mileage claims with vehicle and engine type support',
            'File attachments (receipts, invoices)',
            'Project association and rebilling',
            'Receipt reference tracking'
          ],
          mileage_rates: 'Supports AMAP rates with engine type classification',
          supported_currencies: ['GBP', 'USD', 'EUR', 'and others'],
          example_expense: {
            user: 'https://api.freeagent.com/v2/users/123',
            category: 'https://api.freeagent.com/v2/categories/456',
            dated_on: '2024-01-15',
            ec_status: 'TAXABLE',
            gross_value: 45.99,
            description: 'Office supplies',
            receipt_reference: 'REC-2024-001'
          }
        },
        
        bills: {
          title: 'Bill Management',
          description: 'Create and manage supplier bills with comprehensive line item support',
          key_features: [
            'Multi-line bill items (up to 40 per bill)',
            'Multi-currency support',
            'Project association and rebilling',
            'VAT/EC status handling including Reverse Charge',
            'Attachment support (up to 5MB)',
            'Recurring bill scheduling',
            'Stock item tracking',
            'Advanced filtering and status management'
          ],
          bill_statuses: [
            'Zero Value - Bills with no value',
            'Open - Unpaid bills',
            'Paid - Fully paid bills', 
            'Overdue - Bills past due date',
            'Refunded - Bills that have been refunded'
          ],
          recurring_options: ['Weekly', 'Every 2 Weeks', 'Every 4 Weeks', 'Monthly', 'Every 2 Months', 'Quarterly', 'Every 6 Months', 'Annually'],
          bill_items_structure: {
            description: 'Each bill item contains',
            fields: [
              'description - Item description',
              'price - Unit price',
              'quantity - Quantity ordered',
              'sales_tax_rate - Tax rate percentage', 
              'category - Category URL for accounting',
              'project - Optional project association',
              'stock_item - Optional stock item reference'
            ]
          },
          example_bill: {
            contact: 'https://api.freeagent.com/v2/contacts/123',
            reference: 'INV-2024-001',
            dated_on: '2024-01-15',
            due_on: '2024-02-14',
            ec_status: 'Reverse Charge',
            bill_items: [
              {
                description: 'Professional Services',
                price: 150.00,
                quantity: 8,
                sales_tax_rate: 20,
                category: 'https://api.freeagent.com/v2/categories/456'
              }
            ]
          }
        },
        
        bank_transactions: {
          title: 'Bank Transaction Management',
          description: 'Access and explain bank transactions across multiple accounts',
          workflow: [
            '1. List bank accounts to find relevant account',
            '2. List transactions for specific account with filters',
            '3. Create explanations to categorize transactions',
            '4. Associate with users for expense payments'
          ],
          explanation_types: [
            'Standard business transactions',
            'Expense payments to users',
            'Tax-related transactions',
            'Project-specific costs'
          ],
          example_explanation: {
            bank_transaction: 'https://api.freeagent.com/v2/bank_transactions/789',
            dated_on: '2024-01-15',
            gross_value: -45.99,
            category: 'https://api.freeagent.com/v2/categories/456',
            description: 'Office supplies payment',
            paid_user: 'https://api.freeagent.com/v2/users/123'
          }
        },
        
        attachments: {
          title: 'Attachment Management',
          description: 'Work with existing attachments in FreeAgent for expenses and transaction explanations',
          key_principle: 'Claude cannot upload files - only reference existing attachments in FreeAgent. Attachments must be uploaded via web or mobile app first. Note: Attachment URLs are impossible to see on mobile app and not immediately obvious on web interface.',
          available_tools: [
            'get_attachment - View details of a specific attachment',
            'delete_attachment - Remove attachments that are no longer needed'
          ],
          workflow: [
            '1. Upload attachments via FreeAgent web or mobile app first',
            '2. Find attachment URLs from FreeAgent web interface (not visible on mobile)',
            '3. Reference the attachment URL in create_expense or create_bank_transaction_explanation using the file parameter',
            '4. Alternative: Use FreeAgent Smart Capture (10/month limit) for automatic processing'
          ],
          usage_examples: {
            note: 'Attachments must be uploaded via FreeAgent web/mobile first. URLs not visible on mobile, consider Smart Capture (10/month)',
            reference_in_expense: 'create_expense({ user: "...", category: "...", file: "https://api.freeagent.com/v2/attachments/123" })',
            reference_in_explanation: 'create_bank_transaction_explanation({ ..., file: "https://api.freeagent.com/v2/attachments/123" })'
          },
          attachment_details: {
            url: 'Unique attachment identifier',
            content_src: 'URL to view the attachment',
            file_name: 'Original filename',
            file_size: 'File size in bytes',
            content_type: 'MIME type (image/png, application/pdf, etc.)',
            description: 'Optional attachment description'
          }
        },
        
        image_processing: {
          title: 'Image Processing Capabilities',
          description: 'The FreeAgent MCP server has comprehensive image processing capabilities for receipt and document uploads',
          supported_formats: [
            'PNG images (image/png)',
            'JPEG images (image/jpeg, image/jpg)', 
            'GIF images (image/gif)',
            'PDF documents (application/x-pdf)'
          ],
          image_processing_tools: {
            prepare_attachment: {
              purpose: 'Primary tool for image processing',
              capabilities: [
                'Accepts raw image data in any format',
                'Automatically converts to Base64 encoding',
                'Detects content type from file extension',
                'Creates complete attachment objects',
                'Handles binary, hex, UTF-8, and other input formats'
              ],
              usage: 'prepare_attachment({ file_data: "raw_image_data", file_name: "receipt.png" })'
            }
          },
          workflow_examples: {
            receipt_upload: {
              step1: 'Get image data (from file, URL, or other source)',
              step2: 'Use prepare_attachment to process the image',
              step3: 'Create expense with the processed attachment',
              example: {
                prepare: 'prepare_attachment({ file_data: image_data, file_name: "receipt.jpg" })',
                use: 'create_expense({ user: "...", category: "...", attachment: prepared_attachment })'
              }
            },
            invoice_processing: {
              step1: 'Get PDF or image invoice data',
              step2: 'Process with prepare_attachment',  
              step3: 'Attach to bank transaction explanation',
              example: {
                prepare: 'prepare_attachment({ file_data: pdf_data, file_name: "invoice.pdf" })',
                use: 'create_bank_transaction_explanation({ ..., attachment: prepared_attachment })'
              }
            }
          },
          automatic_processing: {
            description: 'Expense and transaction explanation tools also have built-in image processing',
            direct_usage: 'You can pass raw image data directly to create_expense or create_bank_transaction_explanation',
            example: 'create_expense({ ..., attachment: { data: "raw_image", file_name: "receipt.png" } })',
            note: 'The tools will automatically process and encode the image data'
          },
          key_benefits: [
            'No need for external image processing tools',
            'Handles all common receipt and invoice formats',
            'Automatic Base64 encoding eliminates manual conversion',
            'Built-in validation and error handling',
            'Seamless integration with FreeAgent accounting workflows'
          ]
        },
        
        mileage_claims: {
          title: 'Mileage Claims',
          description: 'Comprehensive mileage expense tracking with HMRC compliance',
          vehicle_types: ['Car', 'Motorcycle', 'Bicycle'],
          engine_types: ['Petrol', 'Diesel', 'LPG', 'Electric', 'Electric_Hybrid'],
          rates: {
            cars_motorcycles: 'AMAP rates apply based on engine type and size',
            bicycles: 'Fixed rate per mile'
          },
          example_claim: {
            user: 'https://api.freeagent.com/v2/users/123',
            category: 'https://api.freeagent.com/v2/categories/travel',
            dated_on: '2024-01-15',
            ec_status: 'TAXABLE',
            mileage: 120,
            vehicle_type: 'Car',
            engine_type: 'Electric',
            engine_size: 0,
            reclaim_mileage: 1,
            description: 'Client meeting in London'
          }
        },
        
        tax_handling: {
          title: 'Tax and VAT Handling',
          description: 'Comprehensive tax management for all transaction types',
          vat_statuses: [
            'TAXABLE - Standard VAT rate applies',
            'EXEMPT - VAT exempt transaction',
            'OUT_OF_SCOPE - Outside VAT scope'
          ],
          tax_calculation: {
            automatic: 'Set sales_tax_rate as percentage (e.g., 20 for 20%)',
            manual: 'Set sales_tax_value as fixed amount'
          },
          example: {
            gross_value: 120.00,
            sales_tax_rate: 20,
            // Results in £20 VAT, £100 net
          }
        }
      };

      const result = params.topic ? (docs as any)[params.topic] : docs;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  server.tool(
    'validate_parameters',
    'Test parameter formats before making actual API calls',
    {
      tool_name: z.string().describe('Tool name to validate parameters for'),
      parameters: z.record(z.any()).describe('Parameters to validate'),
    },
    async ({ tool_name, parameters }: any) => {
      const validation_results: any = {
        tool: tool_name,
        parameters: parameters,
        validation: {
          valid: true,
          errors: [],
          warnings: []
        }
      };

      // Basic validation logic
      if (tool_name.includes('create_') || tool_name.includes('update_')) {
        // Check for common required fields
        if (tool_name.includes('expense')) {
          if (!parameters.user && tool_name === 'create_expense') {
            validation_results.validation.valid = false;
            validation_results.validation.errors.push('user parameter is required for create_expense');
          }
          if (!parameters.category && tool_name === 'create_expense') {
            validation_results.validation.valid = false;
            validation_results.validation.errors.push('category parameter is required for create_expense');
          }
          if (parameters.attachment) {
            if (!parameters.attachment.data) {
              validation_results.validation.errors.push('attachment.data is required when attachment is provided');
            }
            if (!parameters.attachment.file_name) {
              validation_results.validation.errors.push('attachment.file_name is required when attachment is provided');
            }
            if (!parameters.attachment.content_type) {
              validation_results.validation.errors.push('attachment.content_type is required when attachment is provided');
            }
          }
        }

        // Check date formats
        for (const [key, value] of Object.entries(parameters)) {
          if (key.includes('date') && typeof value === 'string') {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value as string)) {
              validation_results.validation.warnings.push(`${key} should be in YYYY-MM-DD format`);
            }
          }
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(validation_results, null, 2),
        }],
      };
    }
  );



  // List timeslips tool
  server.tool(
    'list_timeslips',
    'List and filter timeslips from FreeAgent',
    {
      from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
      view: z.enum(['all', 'unbilled', 'running']).optional().describe('Filter view'),
      user: z.string().optional().describe('User URL to filter by'),
      project: z.string().optional().describe('Project URL to filter by'),
      task: z.string().optional().describe('Task URL to filter by'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const client = createClient(auth);
        const result = await client.listTimeslips(params);
        const enhanced = await enhanceTimeslipData(result, client);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(enhanced, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List projects tool
  server.tool(
    'list_projects',
    'List all projects in FreeAgent',
    {
      view: z.enum(['all', 'active', 'completed']).optional().describe('Filter view (default: active)')
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const view = params.view || 'active';
        const result = await makeDirectRequest(`/projects?view=${view}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Create task tool
  server.tool(
    'create_task',
    'Create a new task for a project in FreeAgent',
    {
      project: z.string().describe('Project URL or ID'),
      name: z.string().describe('Task name'),
      is_recurring: z.boolean().optional().describe('Whether this is a recurring task (default: false)'),
      status: z.enum(['Active', 'Hidden', 'Completed']).optional().describe('Task status (default: Active)')
    },
    async (params: any, { auth }: any = {}) => {
      try {
        // Prepare task data with defaults
        const taskData = {
          name: params.name,
          project: params.project,
          is_billable: true, // Always set to true as requested
          is_recurring: params.is_recurring || false,
          status: params.status || 'Active'
          // Explicitly omitting billing_rate and billing_period as requested
        };

        const result = await makeDirectRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({ task: taskData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single timeslip tool
  server.tool(
    'get_timeslip',
    'Get a specific timeslip by ID',
    {
      id: z.string().describe('Timeslip ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const client = createClient(auth);
        const result = await client.getTimeslip(id);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Create timeslip tool
  server.tool(
    'create_timeslip',
    'Create a new timeslip in FreeAgent',
    {
      task: z.string().describe('Task URL'),
      user: z.string().describe('User URL'),
      project: z.string().describe('Project URL'),
      dated_on: z.string().describe('Date in YYYY-MM-DD format'),
      hours: z.number().describe('Number of hours'),
      comment: z.string().optional().describe('Optional comment'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const client = createClient(auth);
        const result = await client.createTimeslip(params);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Update timeslip tool
  server.tool(
    'update_timeslip',
    'Update an existing timeslip in FreeAgent',
    {
      id: z.string().describe('Timeslip ID'),
      task: z.string().optional().describe('Task URL'),
      user: z.string().optional().describe('User URL'),
      project: z.string().optional().describe('Project URL'),
      dated_on: z.string().optional().describe('Date in YYYY-MM-DD format'),
      hours: z.number().optional().describe('Number of hours'),
      comment: z.string().optional().describe('Comment'),
    },
    async ({ id, ...updateData }: any, { auth }: any = {}) => {
      try {
        const client = createClient(auth);
        const result = await client.updateTimeslip(id, updateData);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Delete timeslip tool
  server.tool(
    'delete_timeslip',
    'Delete a timeslip from FreeAgent',
    {
      id: z.string().describe('Timeslip ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const client = createClient(auth);
        const result = await client.deleteTimeslip(id);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Start timer tool
  server.tool(
    'start_timer',
    'Start a timer for a timeslip in FreeAgent',
    {
      id: z.string().describe('Timeslip ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const client = createClient(auth);
        const result = await client.startTimer(id);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Stop timer tool
  server.tool(
    'stop_timer',
    'Stop a timer for a timeslip in FreeAgent',
    {
      id: z.string().describe('Timeslip ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const client = createClient(auth);
        const result = await client.stopTimer(id);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List bills tool
  server.tool(
    'list_bills',
    'List bills from FreeAgent',
    {
      view: z.enum(['all', 'open', 'overdue', 'paid', 'recurring']).optional().describe('Filter view'),
      from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
      updated_since: z.string().optional().describe('ISO timestamp to get bills updated since'),
      contact: z.string().optional().describe('Contact URL to filter by'),
      project: z.string().optional().describe('Project URL to filter by'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const queryParams = new URLSearchParams();
        
        if (params.view) queryParams.append('view', params.view);
        if (params.from_date) queryParams.append('from_date', params.from_date);
        if (params.to_date) queryParams.append('to_date', params.to_date);
        if (params.updated_since) queryParams.append('updated_since', params.updated_since);
        if (params.contact) queryParams.append('contact', params.contact);
        if (params.project) queryParams.append('project', params.project);
        
        const queryString = queryParams.toString();
        const result = await makeDirectRequest(`/bills${queryString ? `?${queryString}` : ''}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single bill tool
  server.tool(
    'get_bill',
    'Get a specific bill by ID',
    {
      id: z.string().describe('Bill ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/bills/${id}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Create bill tool
  server.tool(
    'create_bill',
    'Create a new bill in FreeAgent with full support for line items, attachments, and project rebilling',
    {
      contact: z.string().describe('Contact URL who is being billed'),
      reference: z.string().describe('Bill reference number'),
      dated_on: z.string().describe('Bill date in YYYY-MM-DD format'),
      due_on: z.string().describe('Bill due date in YYYY-MM-DD format'),
      bill_items: z.array(z.object({
        description: z.string().describe('Item description'),
        price: z.number().describe('Unit price'),
        quantity: z.number().describe('Quantity'),
        sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
        category: z.string().optional().describe('Category URL for accounting'),
        project: z.string().optional().describe('Project URL for item'),
        stock_item: z.string().optional().describe('Stock item reference')
      })).describe('Array of bill line items (max 40 items)'),
      currency: z.string().optional().describe('Currency code (e.g., GBP, USD)'),
      project: z.string().optional().describe('Project URL to associate bill with'),
      ec_status: z.enum(['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS']).optional().describe('VAT status for reporting purposes'),
      file: z.string().optional().describe('URL of existing attachment in FreeAgent'),
      recurring: z.enum(['Weekly', 'Every 2 Weeks', 'Every 4 Weeks', 'Monthly', 'Every 2 Months', 'Quarterly', 'Every 6 Months', 'Annually']).optional().describe('Recurring frequency'),
      rebill_type: z.enum(['marked_up', 'marked_down', 'at_cost']).optional().describe('Rebill type for project billing'),
      rebill_factor: z.number().optional().describe('Rebill percentage (0-100)'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const billData: any = {
          contact: params.contact,
          reference: params.reference,
          dated_on: params.dated_on,
          due_on: params.due_on,
          bill_items: params.bill_items,
          currency: params.currency,
          project: params.project,
          ec_status: params.ec_status,
          file: params.file,
          recurring: params.recurring,
          rebill_type: params.rebill_type,
          rebill_factor: params.rebill_factor,
        };

        // Remove undefined values
        Object.keys(billData).forEach(key => {
          if (billData[key] === undefined) {
            delete billData[key];
          }
        });

        const result = await makeDirectRequest('/bills', {
          method: 'POST',
          body: JSON.stringify({ bill: billData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Update bill tool
  server.tool(
    'update_bill',
    'Update an existing bill in FreeAgent',
    {
      id: z.string().describe('Bill ID'),
      contact: z.string().optional().describe('Contact URL who is being billed'),
      reference: z.string().optional().describe('Bill reference number'),
      dated_on: z.string().optional().describe('Bill date in YYYY-MM-DD format'),
      due_on: z.string().optional().describe('Bill due date in YYYY-MM-DD format'),
      bill_items: z.array(z.object({
        description: z.string().describe('Item description'),
        price: z.number().describe('Unit price'),
        quantity: z.number().describe('Quantity'),
        sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
        category: z.string().optional().describe('Category URL for accounting'),
        project: z.string().optional().describe('Project URL for item'),
        stock_item: z.string().optional().describe('Stock item reference')
      })).optional().describe('Array of bill line items (max 40 items)'),
      currency: z.string().optional().describe('Currency code (e.g., GBP, USD)'),
      project: z.string().optional().describe('Project URL to associate bill with'),
      ec_status: z.enum(['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS']).optional().describe('VAT status for reporting purposes'),
      file: z.string().optional().describe('URL of existing attachment in FreeAgent'),
      recurring: z.enum(['Weekly', 'Every 2 Weeks', 'Every 4 Weeks', 'Monthly', 'Every 2 Months', 'Quarterly', 'Every 6 Months', 'Annually']).optional().describe('Recurring frequency'),
      rebill_type: z.enum(['marked_up', 'marked_down', 'at_cost']).optional().describe('Rebill type for project billing'),
      rebill_factor: z.number().optional().describe('Rebill percentage (0-100)'),
    },
    async ({ id, ...updateData }: any, { auth }: any = {}) => {
      try {
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        const result = await makeDirectRequest(`/bills/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ bill: updateData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Delete bill tool
  server.tool(
    'delete_bill',
    'Delete a bill from FreeAgent',
    {
      id: z.string().describe('Bill ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/bills/${id}`, {
          method: 'DELETE'
        }, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List bank accounts tool
  server.tool(
    'list_bank_accounts',
    'List bank accounts from FreeAgent',
    {
      view: z.enum(['standard_bank_accounts', 'credit_card_accounts', 'paypal_accounts']).optional().describe('Filter by account type'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const queryParams = params.view ? `?view=${params.view}` : '';
        const result = await makeDirectRequest(`/bank_accounts${queryParams}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single bank account tool
  server.tool(
    'get_bank_account',
    'Get a specific bank account by ID',
    {
      id: z.string().describe('Bank account ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/bank_accounts/${id}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List bank transactions tool
  server.tool(
    'list_bank_transactions',
    'List bank transactions from FreeAgent for a specific bank account',
    {
      bank_account: z.string().describe('Bank account URL or ID (required)'),
      from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
      view: z.enum(['all', 'unexplained', 'explained', 'manual', 'imported', 'marked_for_review']).optional().describe('Filter view (default: all)'),
      updated_since: z.string().optional().describe('ISO timestamp to get transactions updated since'),
      last_uploaded: z.boolean().optional().describe('Get only transactions from most recent statement upload'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const queryParams = new URLSearchParams();
        
        // Bank account is required
        queryParams.append('bank_account', params.bank_account);
        
        // Add optional parameters
        if (params.from_date) queryParams.append('from_date', params.from_date);
        if (params.to_date) queryParams.append('to_date', params.to_date);
        if (params.view) queryParams.append('view', params.view);
        if (params.updated_since) queryParams.append('updated_since', params.updated_since);
        if (params.last_uploaded) queryParams.append('last_uploaded', 'true');
        
        const result = await makeDirectRequest(`/bank_transactions?${queryParams.toString()}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single bank transaction tool
  server.tool(
    'get_bank_transaction',
    'Get a specific bank transaction by ID',
    {
      id: z.string().describe('Bank transaction ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/bank_transactions/${id}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List bank transaction explanations tool
  server.tool(
    'list_bank_transaction_explanations',
    'List bank transaction explanations from FreeAgent',
    {
      from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
      updated_since: z.string().optional().describe('ISO timestamp to get explanations updated since'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const queryParams = new URLSearchParams();
        
        if (params.from_date) queryParams.append('from_date', params.from_date);
        if (params.to_date) queryParams.append('to_date', params.to_date);
        if (params.updated_since) queryParams.append('updated_since', params.updated_since);
        
        const queryString = queryParams.toString();
        const result = await makeDirectRequest(`/bank_transaction_explanations${queryString ? `?${queryString}` : ''}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single bank transaction explanation tool
  server.tool(
    'get_bank_transaction_explanation',
    'Get a specific bank transaction explanation by ID',
    {
      id: z.string().describe('Bank transaction explanation ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/bank_transaction_explanations/${id}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Create bank transaction explanation tool
  server.tool(
    'create_bank_transaction_explanation',
    'Create an explanation for a bank transaction in FreeAgent',
    {
      bank_transaction: z.string().optional().describe('Bank transaction URL to explain'),
      bank_account: z.string().optional().describe('Bank account URL (alternative to bank_transaction)'),
      dated_on: z.string().describe('Transaction date in YYYY-MM-DD format'),
      gross_value: z.number().describe('Transaction amount (negative for expenses, positive for income)'),
      category: z.string().describe('Category URL for the transaction'),
      description: z.string().optional().describe('Description of the transaction'),
      sales_tax_status: z.enum(['TAXABLE', 'EXEMPT', 'OUT_OF_SCOPE']).optional().describe('Sales tax status'),
      ec_status: z.enum(['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS']).optional().describe('VAT status for reporting purposes'),
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage (e.g., 20 for 20%)'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL to associate with'),
      file: z.string().optional().describe('URL of existing attachment in FreeAgent. Attachments must be uploaded to FreeAgent via web or mobile app first.'),
      paid_user: z.string().optional().describe('User URL for expense payments (Money Paid to User transactions)'),
      receipt_reference: z.string().optional().describe('Receipt reference number or identifier'),
      marked_for_review: z.boolean().optional().describe('Whether explanation is marked for review (true=needs approval, false=approved)'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const explanationData: any = {
          dated_on: params.dated_on,
          gross_value: params.gross_value,
          category: params.category,
          description: params.description,
          sales_tax_status: params.sales_tax_status,
          ec_status: params.ec_status,
          sales_tax_rate: params.sales_tax_rate,
          sales_tax_value: params.sales_tax_value,
          project: params.project,
          file: params.file,
          paid_user: params.paid_user,
          receipt_reference: params.receipt_reference,
        };

        // Add bank transaction or bank account
        if (params.bank_transaction) {
          explanationData.bank_transaction = params.bank_transaction;
        } else if (params.bank_account) {
          explanationData.bank_account = params.bank_account;
        }


        // Remove undefined values
        Object.keys(explanationData).forEach(key => {
          if (explanationData[key] === undefined) {
            delete explanationData[key];
          }
        });

        const result = await makeDirectRequest('/bank_transaction_explanations', {
          method: 'POST',
          body: JSON.stringify({ bank_transaction_explanation: explanationData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Update bank transaction explanation tool
  server.tool(
    'update_bank_transaction_explanation',
    'Update an existing bank transaction explanation',
    {
      id: z.string().describe('Bank transaction explanation ID'),
      dated_on: z.string().optional().describe('Transaction date in YYYY-MM-DD format'),
      gross_value: z.number().optional().describe('Transaction amount'),
      category: z.string().optional().describe('Category URL'),
      description: z.string().optional().describe('Description'),
      sales_tax_status: z.enum(['TAXABLE', 'EXEMPT', 'OUT_OF_SCOPE']).optional().describe('Sales tax status'),
      ec_status: z.enum(['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS']).optional().describe('VAT status for reporting purposes'),
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL'),
      file: z.string().optional().describe('URL of existing attachment in FreeAgent. Attachments must be uploaded to FreeAgent via web or mobile app first.'),
      paid_user: z.string().optional().describe('User URL for expense payments (Money Paid to User transactions)'),
      receipt_reference: z.string().optional().describe('Receipt reference number or identifier'),
      marked_for_review: z.boolean().optional().describe('Whether explanation is marked for review (true=needs approval, false=approved)'),
    },
    async ({ id, ...updateData }: any, { auth }: any = {}) => {
      try {
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        const result = await makeDirectRequest(`/bank_transaction_explanations/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ bank_transaction_explanation: updateData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Delete bank transaction explanation tool
  server.tool(
    'delete_bank_transaction_explanation',
    'Delete a bank transaction explanation',
    {
      id: z.string().describe('Bank transaction explanation ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/bank_transaction_explanations/${id}`, {
          method: 'DELETE'
        }, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get attachment tool
  server.tool(
    'get_attachment',
    'Get details of a specific attachment by ID',
    {
      id: z.string().describe('Attachment ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/attachments/${id}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Delete attachment tool
  server.tool(
    'delete_attachment',
    'Delete a specific attachment by ID',
    {
      id: z.string().describe('Attachment ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/attachments/${id}`, {
          method: 'DELETE'
        }, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List expenses tool
  server.tool(
    'list_expenses',
    'List expenses from FreeAgent',
    {
      view: z.enum(['recent', 'recurring']).optional().describe('Filter view'),
      from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
      updated_since: z.string().optional().describe('ISO timestamp to get expenses updated since'),
      user: z.string().optional().describe('User URL to filter by'),
      project: z.string().optional().describe('Project URL to filter by'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const queryParams = new URLSearchParams();
        
        if (params.view) queryParams.append('view', params.view);
        if (params.from_date) queryParams.append('from_date', params.from_date);
        if (params.to_date) queryParams.append('to_date', params.to_date);
        if (params.updated_since) queryParams.append('updated_since', params.updated_since);
        if (params.user) queryParams.append('user', params.user);
        if (params.project) queryParams.append('project', params.project);
        
        const queryString = queryParams.toString();
        const result = await makeDirectRequest(`/expenses${queryString ? `?${queryString}` : ''}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single expense tool
  server.tool(
    'get_expense',
    'Get a specific expense by ID',
    {
      id: z.string().describe('Expense ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/expenses/${id}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Create expense tool
  server.tool(
    'create_expense',
    'Create a new expense in FreeAgent',
    {
      user: z.string().describe('User URL (expense claimant)'),
      category: z.string().describe('Category URL for the expense'),
      dated_on: z.string().describe('Expense date in YYYY-MM-DD format'),
      ec_status: z.enum(['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS']).describe('VAT status for reporting purposes'),
      description: z.string().optional().describe('Description of the expense'),
      gross_value: z.number().optional().describe('Gross expense amount'),
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL to associate with'),
      file: z.string().optional().describe('URL of existing attachment in FreeAgent. Attachments must be uploaded to FreeAgent via web or mobile app first.'),
      currency: z.string().optional().describe('Currency code (e.g., GBP, USD)'),
      mileage: z.number().optional().describe('Mileage for travel expenses'),
      vehicle_type: z.enum(['Car', 'Motorcycle', 'Bicycle']).optional().describe('Vehicle type for mileage claims'),
      engine_type: z.enum(['Petrol', 'Diesel', 'LPG', 'Electric', 'Electric_Hybrid']).optional().describe('Engine type for mileage claims'),
      engine_size: z.number().optional().describe('Engine size for mileage claims'),
      reclaim_mileage: z.number().min(0).max(1).optional().describe('Reclaim mileage (0=default, 1=at AMAP rate)'),
      is_rebillable: z.boolean().optional().describe('Whether expense can be rebilled to client'),
      rebill_factor: z.number().optional().describe('Rebill percentage (0-100)'),
      rebill_type: z.enum(['marked_up', 'marked_down', 'at_cost']).optional().describe('Rebill type'),
      receipt_reference: z.string().optional().describe('Receipt reference number or identifier'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const expenseData: any = {
          user: params.user,
          category: params.category,
          dated_on: params.dated_on,
          ec_status: params.ec_status,
          description: params.description,
          gross_value: params.gross_value,
          sales_tax_rate: params.sales_tax_rate,
          sales_tax_value: params.sales_tax_value,
          project: params.project,
          file: params.file,
          currency: params.currency,
          mileage: params.mileage,
          vehicle_type: params.vehicle_type,
          engine_type: params.engine_type,
          engine_size: params.engine_size,
          reclaim_mileage: params.reclaim_mileage,
          is_rebillable: params.is_rebillable,
          rebill_factor: params.rebill_factor,
          rebill_type: params.rebill_type,
          receipt_reference: params.receipt_reference,
        };


        // Remove undefined values
        Object.keys(expenseData).forEach(key => {
          if (expenseData[key] === undefined) {
            delete expenseData[key];
          }
        });

        const result = await makeDirectRequest('/expenses', {
          method: 'POST',
          body: JSON.stringify({ expense: expenseData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Update expense tool
  server.tool(
    'update_expense',
    'Update an existing expense in FreeAgent',
    {
      id: z.string().describe('Expense ID'),
      user: z.string().optional().describe('User URL (expense claimant)'),
      category: z.string().optional().describe('Category URL'),
      dated_on: z.string().optional().describe('Expense date in YYYY-MM-DD format'),
      ec_status: z.enum(['UK/Non-EC', 'EC Goods', 'EC Services', 'Reverse Charge', 'EC VAT MOSS']).optional().describe('VAT status for reporting purposes'),
      description: z.string().optional().describe('Description'),
      gross_value: z.number().optional().describe('Gross expense amount'),
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL'),
      file: z.string().optional().describe('URL of existing attachment in FreeAgent. Attachments must be uploaded to FreeAgent via web or mobile app first.'),
      currency: z.string().optional().describe('Currency code'),
      mileage: z.number().optional().describe('Mileage for travel expenses'),
      vehicle_type: z.enum(['Car', 'Motorcycle', 'Bicycle']).optional().describe('Vehicle type for mileage claims'),
      engine_type: z.enum(['Petrol', 'Diesel', 'LPG', 'Electric', 'Electric_Hybrid']).optional().describe('Engine type for mileage claims'),
      engine_size: z.number().optional().describe('Engine size for mileage claims'),
      reclaim_mileage: z.number().min(0).max(1).optional().describe('Reclaim mileage (0=default, 1=at AMAP rate)'),
      is_rebillable: z.boolean().optional().describe('Whether expense can be rebilled to client'),
      rebill_factor: z.number().optional().describe('Rebill percentage (0-100)'),
      rebill_type: z.enum(['marked_up', 'marked_down', 'at_cost']).optional().describe('Rebill type'),
      receipt_reference: z.string().optional().describe('Receipt reference number or identifier'),
    },
    async ({ id, ...updateData }: any, { auth }: any = {}) => {
      try {
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        const result = await makeDirectRequest(`/expenses/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ expense: updateData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Delete expense tool
  server.tool(
    'delete_expense',
    'Delete an expense from FreeAgent',
    {
      id: z.string().describe('Expense ID'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/expenses/${id}`, {
          method: 'DELETE'
        }, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List categories tool
  server.tool(
    'list_categories',
    'List all categories from FreeAgent',
    {
      sub_accounts: z.boolean().optional().describe('Include sub-accounts in the response'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const queryParams = params.sub_accounts ? '?sub_accounts=true' : '';
        const result = await makeDirectRequest(`/categories${queryParams}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single category tool
  server.tool(
    'get_category',
    'Get a specific category by nominal code',
    {
      nominal_code: z.string().describe('Category nominal code'),
    },
    async ({ nominal_code }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/categories/${nominal_code}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Create category tool
  server.tool(
    'create_category',
    'Create a new category in FreeAgent',
    {
      description: z.string().describe('Category name/description'),
      nominal_code: z.string().describe('Category nominal code'),
      category_type: z.enum(['income', 'cost_of_sales', 'admin_expenses', 'current_assets', 'liabilities', 'equity']).describe('Category type'),
      allowable_for_tax: z.boolean().optional().describe('Whether category is tax deductible'),
      tax_reporting_name: z.string().optional().describe('Name for statutory accounts reporting'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const categoryData: any = {
          description: params.description,
          nominal_code: params.nominal_code,
          category_type: params.category_type,
          allowable_for_tax: params.allowable_for_tax,
          tax_reporting_name: params.tax_reporting_name,
        };

        // Remove undefined values
        Object.keys(categoryData).forEach(key => {
          if (categoryData[key] === undefined) {
            delete categoryData[key];
          }
        });

        const result = await makeDirectRequest('/categories', {
          method: 'POST',
          body: JSON.stringify({ category: categoryData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Update category tool
  server.tool(
    'update_category',
    'Update an existing category in FreeAgent',
    {
      nominal_code: z.string().describe('Category nominal code'),
      description: z.string().optional().describe('Category name/description'),
      allowable_for_tax: z.boolean().optional().describe('Whether category is tax deductible'),
      tax_reporting_name: z.string().optional().describe('Name for statutory accounts reporting'),
    },
    async ({ nominal_code, ...updateData }: any, { auth }: any = {}) => {
      try {
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        const result = await makeDirectRequest(`/categories/${nominal_code}`, {
          method: 'PUT',
          body: JSON.stringify({ category: updateData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Delete category tool
  server.tool(
    'delete_category',
    'Delete a category from FreeAgent (only user-created categories without existing items)',
    {
      nominal_code: z.string().describe('Category nominal code'),
    },
    async ({ nominal_code }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/categories/${nominal_code}`, {
          method: 'DELETE'
        }, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // List users tool
  server.tool(
    'list_users',
    'List users from FreeAgent',
    {
      view: z.enum(['all', 'staff', 'active_staff', 'advisors', 'active_advisors']).optional().describe('Filter users by type'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const queryParams = params.view ? `?view=${params.view}` : '';
        const result = await makeDirectRequest(`/users${queryParams}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get single user tool
  server.tool(
    'get_user',
    'Get details of a specific user by ID',
    {
      id: z.string().describe('User ID (use "me" for current authenticated user)'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/users/${id}`, {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Get current user profile tool
  server.tool(
    'get_current_user',
    'Get the current authenticated user profile',
    {},
    async (params: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest('/users/me', {}, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Create user tool
  server.tool(
    'create_user',
    'Create a new user in FreeAgent',
    {
      first_name: z.string().describe('User first name'),
      last_name: z.string().describe('User last name'),
      email: z.string().describe('User email address'),
      role: z.enum(['Owner', 'Director', 'Employee', 'Shareholder', 'Advisor']).describe('User role'),
      permission_level: z.number().min(0).max(8).describe('Permission level (0-8, higher = more access)'),
      ni_number: z.string().optional().describe('National Insurance Number'),
      unique_tax_reference: z.string().optional().describe('Unique Tax Reference'),
      send_invitation: z.boolean().optional().describe('Send invitation email (default: true)'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const userData: any = {
          first_name: params.first_name,
          last_name: params.last_name,
          email: params.email,
          role: params.role,
          permission_level: params.permission_level,
          ni_number: params.ni_number,
          unique_tax_reference: params.unique_tax_reference,
          send_invitation: params.send_invitation !== false, // Default to true
        };

        // Remove undefined values
        Object.keys(userData).forEach(key => {
          if (userData[key] === undefined) {
            delete userData[key];
          }
        });

        const result = await makeDirectRequest('/users', {
          method: 'POST',
          body: JSON.stringify({ user: userData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Update user tool
  server.tool(
    'update_user',
    'Update an existing user in FreeAgent',
    {
      id: z.string().describe('User ID (use "me" for current user)'),
      first_name: z.string().optional().describe('User first name'),
      last_name: z.string().optional().describe('User last name'),
      email: z.string().optional().describe('User email address'),
      role: z.enum(['Owner', 'Director', 'Employee', 'Shareholder', 'Advisor']).optional().describe('User role'),
      permission_level: z.number().min(0).max(8).optional().describe('Permission level (0-8)'),
      ni_number: z.string().optional().describe('National Insurance Number'),
      unique_tax_reference: z.string().optional().describe('Unique Tax Reference'),
    },
    async ({ id, ...updateData }: any, { auth }: any = {}) => {
      try {
        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        const result = await makeDirectRequest(`/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ user: updateData })
        }, auth);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );

  // Delete user tool
  server.tool(
    'delete_user',
    'Delete a user from FreeAgent',
    {
      id: z.string().describe('User ID to delete'),
    },
    async ({ id }: any, { auth }: any = {}) => {
      try {
        const result = await makeDirectRequest(`/users/${id}`, {
          method: 'DELETE'
        }, auth);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
          isError: true,
        };
      }
    }
  );
};