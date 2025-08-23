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
};