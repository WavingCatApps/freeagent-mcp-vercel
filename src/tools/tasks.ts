import { FreeAgentApiClient } from "../services/api-client.js";
import { ResponseFormat } from "../constants.js";
import type { ListTasksInput, GetTaskInput, CreateTaskInput } from "../schemas/index.js";

/**
 * List all tasks in FreeAgent
 */
export async function listTasks(
  apiClient: FreeAgentApiClient,
  params: ListTasksInput
): Promise<string> {
  const queryParams = new URLSearchParams();

  if (params.view) queryParams.set("view", params.view);
  if (params.project) queryParams.set("project", params.project);
  if (params.updated_since) queryParams.set("updated_since", params.updated_since);
  if (params.sort) queryParams.set("sort", params.sort);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.per_page) queryParams.set("per_page", params.per_page.toString());

  const url = `/tasks${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiClient.get(url);

  if (!response.tasks || response.tasks.length === 0) {
    return "No tasks found.";
  }

  if (params.response_format === ResponseFormat.JSON) {
    return JSON.stringify(response.tasks, null, 2);
  }

  const taskList = response.tasks
    .map((task: any) => {
      return [
        `Task: ${task.name}`,
        `  URL: ${task.url}`,
        `  Project: ${task.project}`,
        `  Status: ${task.status}`,
        `  Billable: ${task.is_billable ? "Yes" : "No"}`,
        task.billing_rate ? `  Billing Rate: ${task.billing_rate} per ${task.billing_period}` : null,
        `  Currency: ${task.currency}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `Found ${response.tasks.length} task(s):\n\n${taskList}`;
}

/**
 * Get details of a specific task
 */
export async function getTask(
  apiClient: FreeAgentApiClient,
  params: GetTaskInput
): Promise<string> {
  const taskId = params.task_id.replace(/^.*\/tasks\//, "");
  const response = await apiClient.get(`/tasks/${taskId}`);
  const task = response.task;

  if (params.response_format === ResponseFormat.JSON) {
    return JSON.stringify(task, null, 2);
  }

  const details = [
    `Task Details:`,
    `  Name: ${task.name}`,
    `  URL: ${task.url}`,
    `  Project: ${task.project}`,
    `  Status: ${task.status}`,
    `  Billable: ${task.is_billable ? "Yes" : "No"}`,
    task.billing_rate ? `  Billing Rate: ${task.billing_rate}` : null,
    task.billing_period ? `  Billing Period: ${task.billing_period}` : null,
    `  Currency: ${task.currency}`,
    `  Is deletable: ${task.is_deletable}`,
    `  Created: ${task.created_at}`,
    `  Updated: ${task.updated_at}`,
  ]
    .filter(Boolean)
    .join("\n");

  return details;
}

/**
 * Create a new task in FreeAgent
 */
export async function createTask(
  apiClient: FreeAgentApiClient,
  params: CreateTaskInput
): Promise<string> {
  const taskData: any = {
    name: params.name,
    project: params.project,
    is_billable: params.is_billable ?? true,
    status: params.status || "Active",
  };

  if (params.billing_rate) taskData.billing_rate = params.billing_rate;
  if (params.billing_period) taskData.billing_period = params.billing_period;

  const response = await apiClient.post("/tasks", { task: taskData });
  const task = response.task;

  return [
    `Task created successfully!`,
    `  Name: ${task.name}`,
    `  URL: ${task.url}`,
    `  Project: ${task.project}`,
    `  Status: ${task.status}`,
    `  Billable: ${task.is_billable ? "Yes" : "No"}`,
    task.billing_rate ? `  Billing Rate: ${task.billing_rate} per ${task.billing_period}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
