// @ts-ignore - The freeagent-mcp package doesn't have proper TypeScript declarations yet
import { FreeAgentClient } from 'freeagent-mcp/build/freeagent-client.js';

// Helper function to create client with credentials from auth info or environment variables
export const createClient = (authInfo?: any) => {
  // Try to get credentials from auth info first, then fall back to environment variables
  const clientId = authInfo?.clientId || process.env.FREEAGENT_CLIENT_ID;
  const clientSecret = authInfo?.clientSecret || process.env.FREEAGENT_CLIENT_SECRET;
  const accessToken = authInfo?.accessToken || process.env.FREEAGENT_ACCESS_TOKEN;
  const refreshToken = authInfo?.refreshToken || process.env.FREEAGENT_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !accessToken || !refreshToken) {
    throw new Error('Missing required FreeAgent credentials. Please provide clientId, clientSecret, accessToken, and refreshToken either through the connector UI or environment variables.');
  }

  return new FreeAgentClient({
    clientId,
    clientSecret,
    accessToken,
    refreshToken
  });
};

// Helper function to make direct API requests using client's axios instance
export const makeDirectRequest = async (endpoint: string, options: any = {}, authInfo?: any) => {
  const client = createClient(authInfo);
  
  const axiosOptions = {
    method: options.method || 'GET',
    url: endpoint,
    data: options.body ? JSON.parse(options.body) : undefined,
    headers: options.headers || {}
  };

  const response = await client.axiosInstance.request(axiosOptions);
  return response.data;
};

// Helper function to make authenticated requests using the client's axios instance
export const getResourceDetails = async (client: any, endpoint: string) => {
  try {
    let response;
    
    if (client && typeof client === 'object') {
      if (client.axiosInstance) {
        response = await client.axiosInstance.get(endpoint);
      } else if (client.axios) {
        response = await client.axios.get(endpoint);
      } else if (client.http) {
        response = await client.http.get(endpoint);
      } else if (client._axios) {
        response = await client._axios.get(endpoint);
      } else {
        // Fallback: inspect the client to find axios
        for (const [key, value] of Object.entries(client)) {
          if (value && typeof value === 'object' && 'get' in value && typeof (value as any).get === 'function') {
            response = await (value as any).get(endpoint);
            break;
          }
        }
      }
    }
    
    if (!response) {
      return null;
    }
    
    return response.data || response;
    
  } catch (error) {
    return null;
  }
};

// Global cache for resource details to persist across MCP requests
const resourceCache = {
  projects: new Map(),
  tasks: new Map(), 
  users: new Map()
};

// Helper function to enhance timeslip data with actual resource names
export const enhanceTimeslipData = async (timeslipData: any, client: any) => {
  // Handle both array format and object with timeslips property
  const timeslips = Array.isArray(timeslipData) ? timeslipData : timeslipData?.timeslips;
  
  if (!timeslips || !Array.isArray(timeslips)) {
    return timeslipData;
  }

  const enhanced = Array.isArray(timeslipData) ? [...timeslipData] : { ...timeslipData };
  const timeslipsToProcess = Array.isArray(enhanced) ? enhanced : enhanced.timeslips;
  
  // Collect all unique IDs first to batch requests
  const projectIds = new Set();
  const taskIds = new Set();
  const userIds = new Set();
  
  timeslipsToProcess.forEach((timeslip: any) => {
    if (timeslip.project) {
      const projectId = timeslip.project.split('/').pop();
      projectIds.add(projectId);
    }
    if (timeslip.task) {
      const taskId = timeslip.task.split('/').pop();
      taskIds.add(taskId);
    }
    if (timeslip.user) {
      const userId = timeslip.user.split('/').pop();
      userIds.add(userId);
    }
  });

  // Fetch missing resource details in parallel
  const fetchPromises = [];
  
  // Fetch missing projects
  const projectIdArray = Array.from(projectIds);
  for (const projectId of projectIdArray) {
    if (!resourceCache.projects.has(projectId)) {
      fetchPromises.push(
        getResourceDetails(client, `/projects/${projectId}`)
          .then(data => resourceCache.projects.set(projectId, data?.project?.name || `Project ${projectId}`))
      );
    }
  }
  
  // Fetch missing tasks
  const taskIdArray = Array.from(taskIds);
  for (const taskId of taskIdArray) {
    if (!resourceCache.tasks.has(taskId)) {
      fetchPromises.push(
        getResourceDetails(client, `/tasks/${taskId}`)
          .then(data => resourceCache.tasks.set(taskId, data?.task?.name || `Task ${taskId}`))
      );
    }
  }
  
  // Fetch missing users
  const userIdArray = Array.from(userIds);
  for (const userId of userIdArray) {
    if (!resourceCache.users.has(userId)) {
      fetchPromises.push(
        getResourceDetails(client, `/users/${userId}`)
          .then(data => {
            const userName = data?.user ? 
              `${data.user.first_name} ${data.user.last_name}`.trim() : 
              `User ${userId}`;
            resourceCache.users.set(userId, userName);
          })
      );
    }
  }

  // Wait for all fetches to complete
  await Promise.all(fetchPromises);
  
  // Apply cached data to timeslips
  for (const timeslip of timeslipsToProcess) {
    if (timeslip.project) {
      const projectId = timeslip.project.split('/').pop();
      timeslip.project_id = projectId;
      timeslip.project_name = resourceCache.projects.get(projectId);
    }
    
    if (timeslip.task) {
      const taskId = timeslip.task.split('/').pop();
      timeslip.task_id = taskId;
      timeslip.task_name = resourceCache.tasks.get(taskId);
    }
    
    if (timeslip.user) {
      const userId = timeslip.user.split('/').pop();
      timeslip.user_id = userId;
      timeslip.user_name = resourceCache.users.get(userId);
    }
  }
  
  return enhanced;
};

