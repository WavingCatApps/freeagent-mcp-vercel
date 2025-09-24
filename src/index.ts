#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';
import { createClient, makeDirectRequest, enhanceTimeslipData } from '../lib/utils.js';

// FreeAgent credentials from environment variables
function getAuth() {
  const clientId = process.env.FREEAGENT_CLIENT_ID;
  const clientSecret = process.env.FREEAGENT_CLIENT_SECRET;
  const accessToken = process.env.FREEAGENT_ACCESS_TOKEN;
  const refreshToken = process.env.FREEAGENT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !accessToken || !refreshToken) {
    throw new Error('Missing FreeAgent credentials. Please set FREEAGENT_CLIENT_ID, FREEAGENT_CLIENT_SECRET, FREEAGENT_ACCESS_TOKEN, and FREEAGENT_REFRESH_TOKEN environment variables.');
  }

  return { clientId, clientSecret, accessToken, refreshToken };
}

// Create stdio-compatible MCP server
const server = new McpServer(
  {
    name: 'freeagent-mcp',
    version: '1.0.0',
    description: 'FreeAgent MCP Server for comprehensive accounting automation'
  }
);

const listTimeslipsSchema = z.object({
  from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
  view: z.enum(['all', 'unbilled', 'running']).optional().describe('Filter view'),
  user: z.string().optional().describe('User URL to filter by'),
  project: z.string().optional().describe('Project URL to filter by'),
  task: z.string().optional().describe('Task URL to filter by'),
});

type ListTimeslipsParams = z.infer<typeof listTimeslipsSchema>;

const listProjectsSchema = z.object({
  view: z.enum(['all', 'active', 'completed']).optional().describe('Filter view (default: active)'),
});

type ListProjectsParams = z.infer<typeof listProjectsSchema>;

// Add minimal tools for testing - we'll expand these
server.tool('list_timeslips', 'List and filter timeslips from FreeAgent', listTimeslipsSchema.shape, async (params: ListTimeslipsParams) => {
  try {
    const auth = getAuth();
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
});

server.tool('list_projects', 'List all projects in FreeAgent', listProjectsSchema.shape, async (params: ListProjectsParams) => {
  try {
    const auth = getAuth();
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
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log server startup (goes to stderr so it doesn't interfere with stdio)
  console.error('FreeAgent MCP Server started via stdio');
}

main().catch((error) => {
  console.error('Failed to start FreeAgent MCP Server:', error);
  process.exit(1);
});
