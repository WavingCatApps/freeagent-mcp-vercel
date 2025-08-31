import { z } from 'zod';
import { createClient, makeDirectRequest, enhanceTimeslipData } from './utils.js';

export const registerTools = (server: any) => {
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
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage (e.g., 20 for 20%)'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL to associate with'),
      attachment: z.string().optional().describe('Attachment data or file reference'),
      paid_user: z.string().optional().describe('User URL for expense payments (Money Paid to User transactions)'),
    },
    async (params: any, { auth }: any = {}) => {
      try {
        const explanationData: any = {
          dated_on: params.dated_on,
          gross_value: params.gross_value,
          category: params.category,
          description: params.description,
          sales_tax_status: params.sales_tax_status,
          sales_tax_rate: params.sales_tax_rate,
          sales_tax_value: params.sales_tax_value,
          project: params.project,
          attachment: params.attachment,
          paid_user: params.paid_user,
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
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL'),
      attachment: z.string().optional().describe('Attachment data or file reference'),
      paid_user: z.string().optional().describe('User URL for expense payments (Money Paid to User transactions)'),
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
      ec_status: z.enum(['TAXABLE', 'EXEMPT', 'OUT_OF_SCOPE']).describe('VAT/EC status'),
      description: z.string().optional().describe('Description of the expense'),
      gross_value: z.number().optional().describe('Gross expense amount'),
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL to associate with'),
      attachment: z.string().optional().describe('Attachment data or file reference'),
      currency: z.string().optional().describe('Currency code (e.g., GBP, USD)'),
      mileage: z.number().optional().describe('Mileage for travel expenses'),
      vehicle_type: z.enum(['Car', 'Motorcycle']).optional().describe('Vehicle type for mileage claims'),
      is_rebillable: z.boolean().optional().describe('Whether expense can be rebilled to client'),
      rebill_factor: z.number().optional().describe('Rebill percentage (0-100)'),
      rebill_type: z.enum(['marked_up', 'marked_down', 'at_cost']).optional().describe('Rebill type'),
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
          attachment: params.attachment,
          currency: params.currency,
          mileage: params.mileage,
          vehicle_type: params.vehicle_type,
          is_rebillable: params.is_rebillable,
          rebill_factor: params.rebill_factor,
          rebill_type: params.rebill_type,
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
      ec_status: z.enum(['TAXABLE', 'EXEMPT', 'OUT_OF_SCOPE']).optional().describe('VAT/EC status'),
      description: z.string().optional().describe('Description'),
      gross_value: z.number().optional().describe('Gross expense amount'),
      sales_tax_rate: z.number().optional().describe('Sales tax rate as percentage'),
      sales_tax_value: z.number().optional().describe('Manual sales tax amount'),
      project: z.string().optional().describe('Project URL'),
      attachment: z.string().optional().describe('Attachment data or file reference'),
      currency: z.string().optional().describe('Currency code'),
      mileage: z.number().optional().describe('Mileage for travel expenses'),
      vehicle_type: z.enum(['Car', 'Motorcycle']).optional().describe('Vehicle type for mileage claims'),
      is_rebillable: z.boolean().optional().describe('Whether expense can be rebilled to client'),
      rebill_factor: z.number().optional().describe('Rebill percentage (0-100)'),
      rebill_type: z.enum(['marked_up', 'marked_down', 'at_cost']).optional().describe('Rebill type'),
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