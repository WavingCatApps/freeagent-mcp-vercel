import { createMcpHandler } from '@vercel/mcp-adapter';
import { z } from 'zod';

interface FreeAgentConfig {
  apiUrl: string;
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

class FreeAgentClient {
  private config: FreeAgentConfig;
  
  constructor(config: FreeAgentConfig) {
    this.config = config;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.config.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`FreeAgent API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async listTimeslips(params: {
    from_date?: string;
    to_date?: string;
    view?: 'all' | 'unbilled' | 'running';
    nested?: string;
  } = {}) {
    const searchParams = new URLSearchParams();
    if (params.from_date) searchParams.set('from_date', params.from_date);
    if (params.to_date) searchParams.set('to_date', params.to_date);
    if (params.view) searchParams.set('view', params.view);
    if (params.nested) searchParams.set('nested', params.nested);

    return this.makeRequest(`/timeslips?${searchParams.toString()}`);
  }

  async createTimeslip(data: {
    task: string;
    user: string;
    project: string;
    dated_on: string;
    hours: number;
    comment?: string;
  }) {
    return this.makeRequest('/timeslips', {
      method: 'POST',
      body: JSON.stringify({ timeslip: data }),
    });
  }

  async updateTimeslip(id: string, data: Partial<{
    task: string;
    user: string;
    project: string;
    dated_on: string;
    hours: number;
    comment: string;
  }>) {
    return this.makeRequest(`/timeslips/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ timeslip: data }),
    });
  }

  async startTimer(id: string) {
    return this.makeRequest(`/timeslips/${id}/timer`, {
      method: 'POST',
    });
  }

  async stopTimer(id: string) {
    return this.makeRequest(`/timeslips/${id}/timer`, {
      method: 'DELETE',
    });
  }
}

const mcpServer = createMcpHandler((server: any) => {
  const client = new FreeAgentClient({
    apiUrl: process.env.FREEAGENT_API_URL || 'https://api.freeagent.com/v2',
    accessToken: process.env.FREEAGENT_ACCESS_TOKEN!,
    refreshToken: process.env.FREEAGENT_REFRESH_TOKEN!,
    clientId: process.env.FREEAGENT_CLIENT_ID!,
    clientSecret: process.env.FREEAGENT_CLIENT_SECRET!,
  });

  server.tool(
    'list_timeslips',
    'List and filter timeslips from FreeAgent',
    {
      from_date: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      to_date: z.string().optional().describe('End date in YYYY-MM-DD format'),
      view: z.enum(['all', 'unbilled', 'running']).optional().describe('Filter view'),
      nested: z.string().optional().describe('Include nested resources'),
    },
    async ({ from_date, to_date, view, nested }: any) => {
      try {
        const result = await client.listTimeslips({
          from_date,
          to_date,
          view,
          nested,
        });
        
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

  server.tool(
    'create_timeslip',
    'Create a new timeslip in FreeAgent',
    {
      task: z.string().describe('Task URL or ID'),
      user: z.string().describe('User URL or ID'),
      project: z.string().describe('Project URL or ID'),
      dated_on: z.string().describe('Date in YYYY-MM-DD format'),
      hours: z.number().describe('Number of hours'),
      comment: z.string().optional().describe('Optional comment'),
    },
    async ({ task, user, project, dated_on, hours, comment }: any) => {
      try {
        const result = await client.createTimeslip({
          task,
          user,
          project,
          dated_on,
          hours,
          comment,
        });
        
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

  server.tool(
    'update_timeslip',
    'Update an existing timeslip in FreeAgent',
    {
      id: z.string().describe('Timeslip ID'),
      task: z.string().optional().describe('Task URL or ID'),
      user: z.string().optional().describe('User URL or ID'),
      project: z.string().optional().describe('Project URL or ID'),
      dated_on: z.string().optional().describe('Date in YYYY-MM-DD format'),
      hours: z.number().optional().describe('Number of hours'),
      comment: z.string().optional().describe('Comment'),
    },
    async ({ id, task, user, project, dated_on, hours, comment }: any) => {
      try {
        const updateData: any = {};
        if (task) updateData.task = task;
        if (user) updateData.user = user;
        if (project) updateData.project = project;
        if (dated_on) updateData.dated_on = dated_on;
        if (hours) updateData.hours = hours;
        if (comment) updateData.comment = comment;

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
});

export default function handler(req: any, res: any) {
  return mcpServer(req, res);
}

export async function GET(req: any) {
  return mcpServer(req);
}

export async function POST(req: any) {
  return mcpServer(req);
}

export async function DELETE(req: any) {
  return mcpServer(req);
}