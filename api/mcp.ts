import { createMcpHandler } from 'mcp-handler';
// @ts-ignore - The freeagent-mcp package doesn't have proper TypeScript declarations yet
import { FreeAgentClient } from 'freeagent-mcp/build/freeagent-client.js';
import { z } from 'zod';

// Wrapper to adapt the existing MCP server tools for Vercel
const handler = createMcpHandler(
  (server: any) => {
    // Set server info with FreeAgent branding
    server.setRequestHandler('initialize', async (request: any) => {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'FreeAgent MCP Server',
          version: '1.0.0',
          icon: 'https://www.freeagent.com/favicon.ico'
        }
      };
    });
    const client = new FreeAgentClient({
      clientId: process.env.FREEAGENT_CLIENT_ID!,
      clientSecret: process.env.FREEAGENT_CLIENT_SECRET!,
      accessToken: process.env.FREEAGENT_ACCESS_TOKEN!,
      refreshToken: process.env.FREEAGENT_REFRESH_TOKEN!
    });

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
      async (params: any) => {
        try {
          const result = await client.listTimeslips(params);
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
      async ({ id }: any) => {
        try {
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
      async (params: any) => {
        try {
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
      async ({ id, ...updateData }: any) => {
        try {
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
      async ({ id }: any) => {
        try {
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
      async ({ id }: any) => {
        try {
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
      async ({ id }: any) => {
        try {
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
  },
  {},
  { basePath: '/api' }
);

export { handler as GET, handler as POST, handler as DELETE };